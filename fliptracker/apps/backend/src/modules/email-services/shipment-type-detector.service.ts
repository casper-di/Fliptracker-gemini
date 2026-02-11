import { Injectable } from '@nestjs/common';

/**
 * Universal shipment type detector
 * Distinguishes between SALE (outgoing - you send) and PURCHASE (incoming - you receive)
 * Works with ANY email from ANY platform (Vinted, Shopify, Amazon, eBay, Colissimo, etc.)
 */
@Injectable()
export class ShipmentTypeDetectorService {
  /**
   * Strip HTML tags from text to enable keyword matching across tags
   */
  private stripHTML(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detect if email is for a SALE (outgoing shipment) or PURCHASE (incoming delivery)
   * Uses scoring: both sale and purchase indicators are counted, highest score wins.
   * This prevents footer text (e.g. "preuve de dépôt" in Chronopost privacy notice)
   * from overriding clear purchase signals in the email body.
   */
  detectType(email: { subject: string; body: string; from?: string }): 'sale' | 'purchase' {
    const bodyLower = this.stripHTML(email.body).toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    const fromLower = email.from?.toLowerCase() || '';
    
    // Detect forwarded emails — these are often purchases forwarded from family
    const isForwarded = /---------- message transféré|---------- forwarded message|^fwd:|^tr\s*:/i.test(email.body);
    
    // Score both directions
    const saleScore = this.scoreSaleSignals(bodyLower, subjectLower, fromLower);
    const purchaseScore = this.scorePurchaseSignals(bodyLower, subjectLower, fromLower);
    
    // For forwarded emails, add small bonus to purchase (reduced from +3 to +1)
    // +3 was too aggressive — some forwarded emails ARE sale notifications
    const adjustedPurchaseScore = isForwarded ? purchaseScore + 1 : purchaseScore;
    
    console.log(`[TypeDetector] Sale score: ${saleScore}, Purchase score: ${adjustedPurchaseScore}${isForwarded ? ' (forwarded +1)' : ''}`);
    
    // If both have signals, highest score wins
    if (saleScore > 0 && adjustedPurchaseScore > 0) {
      return adjustedPurchaseScore >= saleScore ? 'purchase' : 'sale';
    }
    
    if (saleScore > 0) return 'sale';
    if (adjustedPurchaseScore > 0) return 'purchase';
    
    // Default: assume purchase (safer - most emails are incoming deliveries)
    return 'purchase';
  }

  /**
   * Score sale signals (higher = more likely a sale)
   */
  private scoreSaleSignals(body: string, subject: string, from: string): number {
    let score = 0;
    
    // Strong sale signals (+3 each)
    const strongSaleKeywords = [
      'bordereau',
      'étiquette créée',
      'etiquette creee',
      'votre colis a été pris en charge',
      'votre colis a ete pris en charge',
      'remise au transporteur',
      'shipping label',
      'print label',
      'ship your order',
      'tu as vendu',
      'ta vente est confirmée',
      'ta vente est confirmee',
      'félicitations pour ta vente',
      'felicitations pour ta vente',
    ];
    for (const kw of strongSaleKeywords) {
      if (body.includes(kw) || subject.includes(kw)) score += 3;
    }
    
    // Medium sale signals (+2 each)
    const mediumSaleKeywords = [
      'confirmons le dépôt',
      'confirmons le depot',
      'colis déposé',
      'colis depose',
      'dépôt de votre colis',
      'depot de votre colis',
      'étiquette d\'expédition',
      'etiquette d\'expedition',
      'ton article a été acheté',
      'ton article est vendu',
      'article vendu',
      'vous avez vendu',
      'expédiez votre colis',
      'expediez votre colis',
      'déposer votre colis',
      'deposer votre colis',
      'dépose ton colis',
      'déposer au point relais',
      'tu as déposé',
      'vous avez déposé',
      'prêt à être expédié',
      'pret a etre expedie',
      'drop off confirmation',
      'drop_off_confirmation',
      'l\'acheteur a récupéré',
      'l\'acheteur a recupere',
      'votre vente est terminée',
      'votre vente est terminee',
      'envoie ton colis',
      'envoyez votre colis',
      'ton colis a été envoyé',
      'ton colis a ete envoye',
      'buyer has picked up',
      'imprime ton bordereau',
      'imprimez votre bordereau',
      'prépare ton colis',
      'prepare ton colis',
    ];
    for (const kw of mediumSaleKeywords) {
      if (body.includes(kw) || subject.includes(kw)) score += 2;
    }
    
    // Weak sale signals (+1 each) - often found in footers
    const weakSaleKeywords = [
      'preuve de dépôt',
      'preuve de depot',
      'votre preuve de dépôt',
      'a bien été déposé',
      'a bien ete depose',
    ];
    for (const kw of weakSaleKeywords) {
      if (body.includes(kw) || subject.includes(kw)) score += 1;
    }
    
    return score;
  }

  /**
   * Score purchase signals (higher = more likely a purchase)
   */
  private scorePurchaseSignals(body: string, subject: string, from: string): number {
    let score = 0;
    
    // Strong purchase signals (+3 each)
    const strongPurchaseKeywords = [
      'code de retrait',
      'code de récupération',
      'code de recuperation',
      'récupérer ton colis',
      'recuperer ton colis',
      'récupérer votre colis',
      'recuperer votre colis',
      'retirer votre colis',
      'retirer ton colis',
      'colis est disponible',
      'colis disponible',
      'disponible en relais',
      'disponible au retrait',
      'est arrivé dans votre relais',
      'il est temps de récupérer',
      'il est temps de recuperer',
      'withdrawal code',
      'pickup code',
      'ready for pickup',
    ];
    for (const kw of strongPurchaseKeywords) {
      if (body.includes(kw) || subject.includes(kw)) score += 3;
    }
    
    // Medium purchase signals (+2 each)
    const mediumPurchaseKeywords = [
      'votre commande',
      'livraison en cours',
      'livraison prévue',
      'livraison prevue',
      'en cours de livraison',
      'ton colis arrive',
      'votre colis arrive',
      'colis livré',
      'colis livre',
      'à retirer avant le',
      'a retirer avant le',
      'qr code',
      'scanner le qr',
      'présenter le code',
      'presenter le code',
      'votre achat',
      'ton achat',
      'vous avez acheté',
      'vous avez achete',
    ];
    for (const kw of mediumPurchaseKeywords) {
      if (body.includes(kw) || subject.includes(kw)) score += 2;
    }
    
    // Weak purchase signals (+1 each)
    const weakPurchaseKeywords = [
      'expédié par',
      'expedie par',
      'tracking update',
      'in transit',
      'out for delivery',
      'your order',
      'your package',
    ];
    for (const kw of weakPurchaseKeywords) {
      if (body.includes(kw) || subject.includes(kw)) score += 1;
    }
    
    return score;
  }

  /**
   * Get confidence score for type detection (0-100)
   */
  getConfidence(email: { subject: string; body: string; from?: string }): {
    type: 'sale' | 'purchase';
    confidence: number;
    reason: string;
  } {
    const bodyLower = this.stripHTML(email.body).toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    const fromLower = email.from?.toLowerCase() || '';
    
    const type = this.detectType(email);
    const saleScore = this.scoreSaleSignals(bodyLower, subjectLower, fromLower);
    const purchaseScore = this.scorePurchaseSignals(bodyLower, subjectLower, fromLower);
    const totalScore = saleScore + purchaseScore;
    
    const winningScore = type === 'sale' ? saleScore : purchaseScore;
    const confidence = totalScore > 0 ? Math.min(98, Math.round((winningScore / totalScore) * 100)) : 50;
    const reason = `Sale signals: ${saleScore}, Purchase signals: ${purchaseScore}`;
    
    return { type, confidence, reason };
  }
}
