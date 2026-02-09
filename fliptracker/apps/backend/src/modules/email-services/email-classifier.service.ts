import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// @ts-ignore - init.cjs is the Node.js-specific entry point
const { init } = require('@heyputer/puter.js/src/init.cjs');

export interface EmailClassification {
  emailType: 'order_confirmed' | 'label_created' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'pickup_ready' | 'returned' | 'info' | 'promo' | 'unknown';
  sourceType: 'platform' | 'carrier' | 'unknown';
  sourceName: string | null;
  direction: 'sale' | 'purchase' | null;
  confidence: number;
}

interface EmailInput {
  subject: string;
  from: string;
  bodySnippet: string; // First ~2000 chars of body (stripped of HTML)
}

@Injectable()
export class EmailClassifierService {
  private puter: any = null;
  private readonly defaultModel = 'deepseek/deepseek-v3.2-speciale';

  constructor(private configService: ConfigService) {
    const puterToken = this.configService.get<string>('PUTER_AUTH_TOKEN');
    if (puterToken) {
      try {
        this.puter = init(puterToken);
        console.log('[EmailClassifier] Puter.js initialized');
      } catch (error) {
        console.error('[EmailClassifier] Failed to init Puter.js:', error.message);
      }
    } else {
      console.warn('[EmailClassifier] PUTER_AUTH_TOKEN not set — LLM classification disabled');
    }
  }

  /**
   * Classify an email using LLM, with rule-based fallback
   */
  async classify(email: EmailInput): Promise<EmailClassification> {
    // Try rule-based first (fast, free, no API call)
    const ruleResult = this.classifyByRules(email);
    if (ruleResult.confidence >= 0.85) {
      console.log(`[EmailClassifier] Rule-based: ${ruleResult.emailType} (${ruleResult.sourceType}:${ruleResult.sourceName}) conf=${ruleResult.confidence}`);
      return ruleResult;
    }

    // Fallback to LLM if available
    if (this.puter) {
      try {
        const llmResult = await this.classifyByLLM(email);
        if (llmResult && llmResult.confidence > ruleResult.confidence) {
          console.log(`[EmailClassifier] LLM: ${llmResult.emailType} (${llmResult.sourceType}:${llmResult.sourceName}) conf=${llmResult.confidence}`);
          return llmResult;
        }
      } catch (err) {
        console.warn('[EmailClassifier] LLM failed, using rule-based:', err.message);
      }
    }

    return ruleResult;
  }

  // ─── Rule-Based Classification ──────────────────────────────────────

  private classifyByRules(email: EmailInput): EmailClassification {
    const from = email.from.toLowerCase();
    const subject = email.subject.toLowerCase();
    const body = email.bodySnippet.toLowerCase();
    const combined = `${subject} ${from} ${body}`;

    // Detect source
    const { sourceType, sourceName } = this.detectSource(from, subject, body);

    // Detect email type
    const { emailType, confidence: typeConf } = this.detectEmailType(subject, body);

    // Detect direction (sale vs purchase)
    const direction = this.detectDirection(subject, body, sourceType, sourceName);

    // Overall confidence
    const confidence = Math.min(
      sourceType !== 'unknown' ? typeConf + 0.1 : typeConf,
      1.0,
    );

    return { emailType, sourceType, sourceName, direction, confidence };
  }

  private detectSource(from: string, subject: string, body: string): { sourceType: 'platform' | 'carrier' | 'unknown'; sourceName: string | null } {
    // Platform detection (marketplaces)
    const platforms: Array<{ keywords: string[]; name: string }> = [
      { keywords: ['vinted'], name: 'vinted' },
      { keywords: ['leboncoin'], name: 'leboncoin' },
      { keywords: ['vestiaire-collective', 'vestiairecollective'], name: 'vestiaire_collective' },
      { keywords: ['amazon'], name: 'amazon' },
      { keywords: ['ebay'], name: 'ebay' },
      { keywords: ['depop'], name: 'depop' },
      { keywords: ['wallapop'], name: 'wallapop' },
      { keywords: ['shopify'], name: 'shopify' },
      { keywords: ['cdiscount'], name: 'cdiscount' },
      { keywords: ['fnac'], name: 'fnac' },
      { keywords: ['aliexpress'], name: 'aliexpress' },
    ];

    for (const p of platforms) {
      if (p.keywords.some(kw => from.includes(kw) || subject.includes(kw))) {
        return { sourceType: 'platform', sourceName: p.name };
      }
    }

    // Carrier detection (from sender primarily)
    const carriers: Array<{ keywords: string[]; name: string }> = [
      { keywords: ['colissimo', 'laposte'], name: 'colissimo' },
      { keywords: ['chronopost'], name: 'chronopost' },
      { keywords: ['mondial-relay', 'mondialrelay'], name: 'mondial_relay' },
      { keywords: ['relais-colis', 'relaiscolis'], name: 'relais_colis' },
      { keywords: ['dhl'], name: 'dhl' },
      { keywords: ['ups.com', 'ups '], name: 'ups' },
      { keywords: ['fedex'], name: 'fedex' },
      { keywords: ['dpd'], name: 'dpd' },
      { keywords: ['gls'], name: 'gls' },
      { keywords: ['colis-prive', 'colisprive'], name: 'colis_prive' },
    ];

    for (const c of carriers) {
      if (c.keywords.some(kw => from.includes(kw))) {
        return { sourceType: 'carrier', sourceName: c.name };
      }
    }

    // Fallback: check subject for carrier mentions (less reliable)
    for (const c of carriers) {
      if (c.keywords.some(kw => subject.includes(kw))) {
        return { sourceType: 'carrier', sourceName: c.name };
      }
    }

    return { sourceType: 'unknown', sourceName: null };
  }

  private detectEmailType(subject: string, body: string): { emailType: EmailClassification['emailType']; confidence: number } {
    const combined = `${subject} ${body}`;

    // Promo / Newsletter (check first to filter out)
    const promoSignals = [
      'unsubscribe', 'se désabonner', 'désinscrire', 'newsletter',
      'offre spéciale', 'special offer', 'promotion', '% off', '% de réduction',
      'soldes', 'vente flash', 'flash sale', 'code promo', 'coupon',
      'ne manquez pas', 'don\'t miss',
    ];
    const promoCount = promoSignals.filter(s => combined.includes(s)).length;
    if (promoCount >= 2) {
      return { emailType: 'promo', confidence: 0.90 };
    }

    // Delivered / Pickup ready
    const deliveredPatterns = [
      /(?:a été|has been).*(?:livré|delivered)/i,
      /(?:livraison|delivery).*(?:effectuée|completed|confirmée)/i,
      /colis.*(?:livré|remis|distribué)/i,
      /(?:successfully|bien)\s+(?:delivered|livré)/i,
      /signé par|signed by/i,
    ];
    const pickupReadyPatterns = [
      /(?:vous attend|est arrivé|est disponible).*(?:point|relais|relay)/i,
      /(?:ready|prêt).*(?:pickup|retrait|collect)/i,
      /(?:retirer|récupérer).*(?:votre|your).*(?:colis|parcel)/i,
      /(?:mis à disposition|available for collection)/i,
      /(?:en attente de retrait|awaiting collection)/i,
    ];

    for (const p of pickupReadyPatterns) {
      if (p.test(combined)) return { emailType: 'pickup_ready', confidence: 0.90 };
    }
    for (const p of deliveredPatterns) {
      if (p.test(combined)) return { emailType: 'delivered', confidence: 0.88 };
    }

    // Returned
    const returnedPatterns = [
      /(?:retourné|returned|renvoyé)/i,
      /return.*(?:to sender|à l'expéditeur)/i,
      /(?:non retiré|not collected|non réclamé)/i,
    ];
    for (const p of returnedPatterns) {
      if (p.test(combined)) return { emailType: 'returned', confidence: 0.88 };
    }

    // Out for delivery
    const outForDeliveryPatterns = [
      /(?:en cours de livraison|out for delivery)/i,
      /(?:en tournée|on its way to you)/i,
      /(?:sera livré|will be delivered).*(?:aujourd'hui|today)/i,
      /(?:livreur|driver).*(?:en route|on the way)/i,
    ];
    for (const p of outForDeliveryPatterns) {
      if (p.test(combined)) return { emailType: 'out_for_delivery', confidence: 0.88 };
    }

    // In transit / Shipped
    const shippedPatterns = [
      /(?:a été|has been).*(?:expédié|shipped|envoyé|dispatched)/i,
      /(?:votre|your).*(?:colis|parcel|commande|order).*(?:en route|on the way)/i,
      /(?:pris en charge|picked up by carrier)/i,
      /(?:confié à|handed to)/i,
    ];
    const inTransitPatterns = [
      /(?:en transit|in transit)/i,
      /(?:en cours d'acheminement|being transported)/i,
      /(?:en cours de transport)/i,
    ];

    for (const p of inTransitPatterns) {
      if (p.test(combined)) return { emailType: 'in_transit', confidence: 0.85 };
    }
    for (const p of shippedPatterns) {
      if (p.test(combined)) return { emailType: 'shipped', confidence: 0.85 };
    }

    // Label created
    const labelPatterns = [
      /(?:étiquette|label).*(?:créée|created|générée|generated)/i,
      /(?:imprimer|print).*(?:étiquette|label|bordereau)/i,
      /(?:télécharger|download).*(?:bordereau|label|étiquette)/i,
      /(?:votre étiquette|your label)/i,
    ];
    for (const p of labelPatterns) {
      if (p.test(combined)) return { emailType: 'label_created', confidence: 0.88 };
    }

    // Order confirmed
    const orderPatterns = [
      /(?:commande|order).*(?:confirmée|confirmed)/i,
      /(?:achat|purchase).*(?:confirmé|confirmed)/i,
      /(?:paiement|payment).*(?:reçu|received|accepté|accepted)/i,
      /(?:merci pour votre achat|thank you for your purchase)/i,
      /(?:article vendu|item sold)/i,
    ];
    for (const p of orderPatterns) {
      if (p.test(combined)) return { emailType: 'order_confirmed', confidence: 0.82 };
    }

    // Info (generic transactional but not tracking)
    const infoSignals = ['tracking', 'suivi', 'colis', 'livraison', 'shipment', 'parcel'];
    const infoCount = infoSignals.filter(s => combined.includes(s)).length;
    if (infoCount >= 2) {
      return { emailType: 'info', confidence: 0.60 };
    }

    return { emailType: 'unknown', confidence: 0.30 };
  }

  private detectDirection(subject: string, body: string, sourceType: string, sourceName: string | null): 'sale' | 'purchase' | null {
    const combined = `${subject} ${body}`;

    // Sale signals (you are the seller)
    const saleSignals = [
      'vous avez vendu', 'tu as vendu', 'article vendu', 'vente confirmée',
      'expédier votre', 'envoyer le colis', 'imprimer l\'étiquette',
      'bordereau', 'étiquette d\'expédition', 'shipping label created',
      'print your label', 'ship your item', 'you sold',
      'expédiez', 'préparez votre envoi', 'confier votre colis',
    ];

    // Purchase signals (you are the buyer)
    const purchaseSignals = [
      'vous avez acheté', 'votre commande', 'votre achat', 'votre colis arrive',
      'your order', 'your purchase', 'your package', 'livraison prévue',
      'estimated delivery', 'en cours de livraison vers vous',
      'sera livré', 'will be delivered', 'arrivera le',
      'retirer votre colis', 'récupérer votre colis', 'pick up your parcel',
    ];

    const saleScore = saleSignals.filter(s => combined.toLowerCase().includes(s)).length;
    const purchaseScore = purchaseSignals.filter(s => combined.toLowerCase().includes(s)).length;

    if (saleScore > purchaseScore && saleScore >= 1) return 'sale';
    if (purchaseScore > saleScore && purchaseScore >= 1) return 'purchase';

    // Heuristic: carrier emails about pickup = purchase
    if (sourceType === 'carrier') return 'purchase';

    return null;
  }

  // ─── LLM Classification ─────────────────────────────────────────────

  private async classifyByLLM(email: EmailInput): Promise<EmailClassification | null> {
    const model = this.configService.get<string>('DEEPSEEK_MODEL') || this.defaultModel;

    const prompt = [
      'You are an email classifier for a parcel tracking app. Classify the following email.',
      'Return ONLY valid JSON (no markdown, no explanation).',
      '',
      'Output format:',
      '{',
      '  "emailType": "order_confirmed|label_created|shipped|in_transit|out_for_delivery|delivered|pickup_ready|returned|info|promo|unknown",',
      '  "sourceType": "platform|carrier|unknown",',
      '  "sourceName": "vinted|leboncoin|amazon|ebay|colissimo|chronopost|mondial_relay|dhl|ups|fedex|...|null",',
      '  "direction": "sale|purchase|null",',
      '  "confidence": 0.0-1.0',
      '}',
      '',
      'Rules:',
      '- sourceType=platform means the email is from a marketplace (Vinted, Amazon, eBay, etc.)',
      '- sourceType=carrier means the email is from a shipping company (Colissimo, DHL, Chronopost, etc.)',
      '- direction=sale means the user is the SELLER (sending a package)',
      '- direction=purchase means the user is the BUYER (receiving a package)',
      '- emailType=promo for newsletters, marketing, promotions - NOT related to a specific shipment',
      '- emailType=info for general transactional emails without specific tracking status update',
      '',
      `From: ${email.from}`,
      `Subject: ${email.subject}`,
      `Body (first 1500 chars): ${email.bodySnippet.substring(0, 1500)}`,
    ].join('\n');

    try {
      const response: any = await this.puter.ai.chat(prompt, { model, stream: false } as any);

      let content = '';
      if (typeof response === 'string') content = response;
      else if (response?.message?.content) content = response.message.content.toString();
      else if (response?.content) content = response.content.toString();
      else if (response?.choices?.[0]?.message?.content) content = response.choices[0].message.content;
      else if (response?.text) content = response.text.toString();

      if (!content) return null;

      const cleaned = content
        .replace(/^```json\n?/i, '')
        .replace(/^```\n?/i, '')
        .replace(/```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      // Validate
      const validEmailTypes = ['order_confirmed', 'label_created', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'pickup_ready', 'returned', 'info', 'promo', 'unknown'];
      const validSourceTypes = ['platform', 'carrier', 'unknown'];

      if (!validEmailTypes.includes(parsed.emailType)) parsed.emailType = 'unknown';
      if (!validSourceTypes.includes(parsed.sourceType)) parsed.sourceType = 'unknown';
      if (parsed.direction && !['sale', 'purchase'].includes(parsed.direction)) parsed.direction = null;
      if (typeof parsed.confidence !== 'number') parsed.confidence = 0.7;

      return parsed as EmailClassification;
    } catch (error) {
      console.warn('[EmailClassifier] LLM parse error:', error.message);
      return null;
    }
  }

  /**
   * Strip HTML tags and collapse whitespace for LLM input
   */
  static stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
