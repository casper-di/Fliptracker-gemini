import { Injectable, OnModuleInit } from '@nestjs/common';
import * as postal from 'node-postal';
import { parseOneAddress } from 'mailparser';
import { parseDocument } from 'htmlparser2';
import { Ollama } from 'ollama';

interface NLPExtractionResult {
  language_detected: string;
  sender: {
    name: string | null;
    company: string | null;
    email: string | null;
  };
  carrier: {
    name: string | null;
    confidence: number;
  };
  tracking: {
    number: string | null;
    confidence: number;
  };
  addresses: Array<{
    type: 'shipping' | 'billing' | 'sender' | 'unknown';
    raw_text: string;
    street: string | null;
    postal_code: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
    confidence: number;
  }>;
  product: {
    name: string | null;
    description: string | null;
    price: number | null;
    currency: string | null;
  };
  dates: {
    pickup_deadline: Date | null;
    estimated_delivery: Date | null;
  };
  codes: {
    withdrawal: string | null;
    qr: string | null;
    order_number: string | null;
  };
  warnings: string[];
}

/**
 * NLP-powered email parsing service using local models
 * No external APIs, no training required, works offline
 */
@Injectable()
export class NLPService implements OnModuleInit {
  private ollama: Ollama;
  private model: string = 'llama3.1:8b-instruct'; // Default model

  async onModuleInit() {
    // Initialize Ollama client
    this.ollama = new Ollama({ host: 'http://localhost:11434' });
    
    // Check if model is available, pull if needed
    await this.ensureModelAvailable();
  }

  /**
   * Ensure LLM model is available locally
   */
  private async ensureModelAvailable(): Promise<void> {
    try {
      const models = ['llama3.1:8b-instruct', 'qwen2.5:7b-instruct', 'mistral:7b-instruct'];
      
      for (const model of models) {
        try {
          await this.ollama.show({ name: model });
          this.model = model;
          console.log(`✅ [NLP] Using model: ${model}`);
          return;
        } catch (e) {
          console.log(`⏳ [NLP] Model ${model} not found, trying next...`);
        }
      }
      
      // No model found, pull the first one
      console.log(`📥 [NLP] Pulling model: ${models[0]}...`);
      await this.ollama.pull({ model: models[0], stream: false });
      this.model = models[0];
      console.log(`✅ [NLP] Model ready: ${models[0]}`);
    } catch (error) {
      console.error(`❌ [NLP] Failed to setup model:`, error.message);
      console.log(`⚠️  [NLP] Will fallback to rule-based parsing only`);
    }
  }

  /**
   * Main parsing pipeline
   */
  async parseEmail(email: {
    subject: string;
    from: string;
    body: string;
    receivedAt?: Date;
  }): Promise<NLPExtractionResult> {
    const warnings: string[] = [];
    
    // Step 1: Clean HTML
    const cleanText = this.cleanHTML(email.body);
    
    // Step 2: Detect language
    const language = this.detectLanguage(cleanText + ' ' + email.subject);
    
    // Step 3: Extract sender info
    const sender = this.extractSender(email.from);
    
    // Step 4: Extract addresses using libpostal
    const addresses = this.extractAddresses(cleanText);
    
    // Step 5: Extract tracking number (deterministic)
    const tracking = this.extractTracking(cleanText + ' ' + email.subject);
    
    // Step 6: Extract carrier (rule-based + signatures)
    const carrier = this.extractCarrier(email.from, email.subject, cleanText);
    
    // Step 7: Extract product info
    const product = this.extractProduct(cleanText);
    
    // Step 8: Extract dates
    const dates = this.extractDates(cleanText, language);
    
    // Step 9: Extract codes (withdrawal, QR, order)
    const codes = this.extractCodes(cleanText);
    
    // Step 10: Use LLM for disambiguation if needed
    const refined = await this.refinWithLLM({
      language,
      sender,
      carrier,
      tracking,
      addresses,
      product,
      dates,
      codes,
      cleanText,
      subject: email.subject,
    });

    return {
      language_detected: language,
      sender: refined.sender || sender,
      carrier: refined.carrier || carrier,
      tracking: refined.tracking || tracking,
      addresses: refined.addresses || addresses,
      product: refined.product || product,
      dates: refined.dates || dates,
      codes: refined.codes || codes,
      warnings: refined.warnings || warnings,
    };
  }

  /**
   * Clean HTML to plain text
   */
  private cleanHTML(html: string): string {
    const dom = parseDocument(html);
    const text = this.extractText(dom);
    return text.replace(/\s+/g, ' ').trim();
  }

  private extractText(node: any): string {
    if (node.type === 'text') return node.data;
    if (node.children) {
      return node.children.map((child: any) => this.extractText(child)).join(' ');
    }
    return '';
  }

  /**
   * Detect language using simple heuristics
   */
  private detectLanguage(text: string): string {
    const lowerText = text.toLowerCase();
    
    const patterns = {
      fr: ['votre', 'colis', 'livraison', 'retirer', 'récupérer', 'expédition'],
      en: ['your', 'parcel', 'delivery', 'pickup', 'shipping', 'order'],
      de: ['ihre', 'paket', 'lieferung', 'abholen', 'versand'],
      es: ['su', 'paquete', 'entrega', 'recoger', 'envío'],
      it: ['tuo', 'pacco', 'consegna', 'ritiro', 'spedizione'],
    };
    
    const scores: Record<string, number> = {};
    
    for (const [lang, keywords] of Object.entries(patterns)) {
      scores[lang] = keywords.filter(kw => lowerText.includes(kw)).length;
    }
    
    const detected = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return detected && detected[1] > 0 ? detected[0] : 'en';
  }

  /**
   * Extract sender information
   */
  private extractSender(from: string): NLPExtractionResult['sender'] {
    try {
      const parsed = parseOneAddress(from);
      return {
        name: parsed?.name || null,
        company: null, // Will be refined by LLM
        email: parsed?.address || null,
      };
    } catch {
      return { name: null, company: null, email: from };
    }
  }

  /**
   * Extract addresses using libpostal
   */
  private extractAddresses(text: string): NLPExtractionResult['addresses'] {
    const addresses: NLPExtractionResult['addresses'] = [];
    
    // Find potential address blocks (text with postal code patterns)
    const postalCodeRegex = /\b\d{5}\b|\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/g;
    const matches = [...text.matchAll(postalCodeRegex)];
    
    for (const match of matches) {
      const index = match.index!;
      const contextStart = Math.max(0, index - 100);
      const contextEnd = Math.min(text.length, index + 100);
      const addressBlock = text.slice(contextStart, contextEnd);
      
      try {
        const parsed = postal.parser.parse_address(addressBlock);
        
        const addr: any = {};
        for (const component of parsed) {
          addr[component.label] = component.value;
        }
        
        addresses.push({
          type: 'unknown',
          raw_text: addressBlock.trim(),
          street: addr.road || addr.house_number ? `${addr.house_number || ''} ${addr.road || ''}`.trim() : null,
          postal_code: addr.postcode || null,
          city: addr.city || addr.city_district || null,
          region: addr.state || addr.state_district || null,
          country: addr.country || null,
          confidence: 0.7,
        });
      } catch (error) {
        // Fallback: simple regex extraction
        const simpleAddr = this.extractAddressSimple(addressBlock);
        if (simpleAddr) addresses.push(simpleAddr);
      }
    }
    
    return addresses;
  }

  private extractAddressSimple(text: string): NLPExtractionResult['addresses'][0] | null {
    const postalMatch = text.match(/\b(\d{5})\b/);
    const cityMatch = text.match(/\d{5}\s+([A-ZÀ-Ÿ][a-zà-ÿ\s-]+)/);
    
    if (postalMatch && cityMatch) {
      return {
        type: 'unknown',
        raw_text: text.trim(),
        street: null,
        postal_code: postalMatch[1],
        city: cityMatch[1].trim(),
        region: null,
        country: null,
        confidence: 0.5,
      };
    }
    
    return null;
  }

  /**
   * Extract tracking number (deterministic patterns)
   */
  private extractTracking(text: string): NLPExtractionResult['tracking'] {
    const patterns = [
      { regex: /\b1Z[A-Z0-9]{16}\b/g, confidence: 0.95 }, // UPS
      { regex: /\b\d{12}\b/g, confidence: 0.8 }, // FedEx
      { regex: /\b[6-8][AV]\d{11}\b/g, confidence: 0.9 }, // Colissimo
      { regex: /\b\d{16,20}\b/g, confidence: 0.7 }, // Generic long number
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        return { number: match[0], confidence: pattern.confidence };
      }
    }
    
    return { number: null, confidence: 0 };
  }

  /**
   * Extract carrier name (rule-based)
   */
  private extractCarrier(from: string, subject: string, body: string): NLPExtractionResult['carrier'] {
    const text = `${from} ${subject} ${body}`.toLowerCase();
    
    const carriers = [
      { name: 'Vinted Go', keywords: ['vinted', 'vinted go'], confidence: 0.95 },
      { name: 'Mondial Relay', keywords: ['mondial relay', 'mondialrelay'], confidence: 0.95 },
      { name: 'Colissimo', keywords: ['colissimo', 'laposte'], confidence: 0.9 },
      { name: 'Chronopost', keywords: ['chronopost'], confidence: 0.95 },
      { name: 'DHL', keywords: ['dhl'], confidence: 0.9 },
      { name: 'UPS', keywords: ['ups'], confidence: 0.9 },
      { name: 'FedEx', keywords: ['fedex'], confidence: 0.9 },
    ];
    
    for (const carrier of carriers) {
      for (const keyword of carrier.keywords) {
        if (text.includes(keyword)) {
          return { name: carrier.name, confidence: carrier.confidence };
        }
      }
    }
    
    return { name: null, confidence: 0 };
  }

  /**
   * Extract product information
   */
  private extractProduct(text: string): NLPExtractionResult['product'] {
    // Look for price patterns
    const priceMatch = text.match(/(\d+[.,]\d{2})\s*€|€\s*(\d+[.,]\d{2})/);
    const price = priceMatch ? parseFloat((priceMatch[1] || priceMatch[2]).replace(',', '.')) : null;
    
    return {
      name: null, // Will be extracted by LLM
      description: null,
      price,
      currency: price ? 'EUR' : null,
    };
  }

  /**
   * Extract dates
   */
  private extractDates(text: string, language: string): NLPExtractionResult['dates'] {
    const datePatterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g, // dd/mm/yyyy
      /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/gi,
    ];
    
    // Simple extraction - will be refined by LLM
    return {
      pickup_deadline: null,
      estimated_delivery: null,
    };
  }

  /**
   * Extract codes (withdrawal, QR, order)
   */
  private extractCodes(text: string): NLPExtractionResult['codes'] {
    // Withdrawal code: usually 5-10 alphanumeric near "code" keyword
    const withdrawalMatch = text.match(/code[^A-Z0-9]{0,20}([A-Z0-9]{4,10})/i);
    
    // Order number: often starts with # or "order"
    const orderMatch = text.match(/(?:order|commande|n[°o])[:\s#]*([A-Z0-9\-]{6,20})/i);
    
    return {
      withdrawal: withdrawalMatch ? withdrawalMatch[1] : null,
      qr: null, // QR data is usually in attachments, not text
      order_number: orderMatch ? orderMatch[1] : null,
    };
  }

  /**
   * Use LLM to refine and disambiguate extracted data
   */
  private async refinWithLLM(data: any): Promise<Partial<NLPExtractionResult>> {
    try {
      const prompt = this.buildLLMPrompt(data);
      
      const response = await this.ollama.chat({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for deterministic output
          num_predict: 500,
        },
      });
      
      const result = JSON.parse(response.message.content);
      return result;
    } catch (error) {
      console.error('[NLP] LLM refinement failed:', error.message);
      return {}; // Return empty object, will use rule-based results
    }
  }

  /**
   * Build prompt for LLM
   */
  private buildLLMPrompt(data: any): string {
    return `You are a logistics email parser. Extract and structure the following information from this email.

Email subject: ${data.subject}
Email text: ${data.cleanText.slice(0, 1000)}

Current extractions (may contain errors):
- Carrier: ${data.carrier.name || 'unknown'}
- Tracking: ${data.tracking.number || 'none'}
- Addresses found: ${data.addresses.length}
- Product price: ${data.product.price || 'none'}

YOUR TASK:
1. Identify the product name if visible
2. Confirm the carrier name
3. Determine if this is a shipping label email (SALE) or pickup notification (PURCHASE)
4. Extract the pickup deadline date if mentioned
5. Classify address type (shipping/pickup/sender)

Output ONLY valid JSON in this format:
{
  "product": { "name": "..." },
  "carrier": { "name": "...", "confidence": 0.9 },
  "shipment_type": "sale" or "purchase",
  "dates": { "pickup_deadline": "YYYY-MM-DD or null" },
  "addresses": [{ "type": "shipping|pickup|sender" }],
  "warnings": []
}

If unsure, set confidence low and add warning. NO HALLUCINATIONS.`;
  }
}
