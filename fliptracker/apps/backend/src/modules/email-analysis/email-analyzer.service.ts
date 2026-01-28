import { Injectable } from '@nestjs/common';
import { ParcelsService } from '../parcels/parcels.service';
import { Carrier, ParcelType, ParcelStatus } from '../../domain/entities';

interface AnalyzedEmail {
  trackingNumber: string | null;
  carrier: Carrier;
  type: ParcelType;
  status: ParcelStatus;
  title: string;
  price: number | null;
  currency: string | null;
}

interface EmailInput {
  id: string;
  subject: string;
  body: string;
  from: string;
  provider: 'gmail' | 'outlook';
}

const TRACKING_PATTERNS: { carrier: Carrier; patterns: RegExp[] }[] = [
  {
    carrier: 'ups',
    patterns: [/\b1Z[A-Z0-9]{16}\b/i],
  },
  {
    carrier: 'fedex',
    patterns: [
      /\b\d{12,14}\b/,
      /\b\d{15}\b/,
      /\b\d{20}\b/,
    ],
  },
  {
    carrier: 'usps',
    patterns: [
      /\b9[2-5]\d{20,22}\b/,
      /\b[A-Z]{2}\d{9}US\b/i,
    ],
  },
  {
    carrier: 'dhl',
    patterns: [
      /\b\d{10}\b/,
      /\b[A-Z]{3}\d{7}\b/i,
    ],
  },
  {
    carrier: 'laposte',
    patterns: [
      /\b[A-Z]{2}\d{9}FR\b/i,
      /\b\d{13}\b/,
    ],
  },
  {
    carrier: 'colissimo',
    patterns: [
      /\b[A-Z0-9]{13}\b/,
      /\b\d{11}\b/,
    ],
  },
  {
    carrier: 'chronopost',
    patterns: [
      /\b[A-Z]{2}\d{9}[A-Z]{2}\b/i,
      /\b\d{13}\b/,
    ],
  },
];

const MARKETPLACE_KEYWORDS = [
  'vinted',
  'amazon',
  'ebay',
  'shopify',
  'etsy',
  'aliexpress',
  'leboncoin',
  'cdiscount',
  'fnac',
];

const SALE_KEYWORDS = ['sale', 'sold', 'vente', 'vendu', 'payment received', 'paiement reçu'];
const PURCHASE_KEYWORDS = ['order', 'commande', 'purchase', 'achat', 'bought', 'acheté'];

const STATUS_KEYWORDS = {
  delivered: ['delivered', 'livré', 'remis', 'distribué'],
  in_transit: ['shipped', 'expédié', 'in transit', 'en cours', 'en route'],
  returned: ['returned', 'retourné', 'renvoyé'],
};

@Injectable()
export class EmailAnalyzerService {
  constructor(private parcelsService: ParcelsService) {}

  async analyzeAndSave(userId: string, email: EmailInput): Promise<void> {
    const analysis = this.analyze(email);
    
    if (!analysis.trackingNumber) {
      return;
    }

    const existingParcel = await this.parcelsService.findByTrackingNumber(
      userId,
      analysis.trackingNumber,
    );

    if (existingParcel) {
      if (analysis.status !== 'unknown' && existingParcel.status !== analysis.status) {
        await this.parcelsService.update(existingParcel.id, {
          status: analysis.status,
        });
      }
      return;
    }

    await this.parcelsService.create({
      userId,
      trackingNumber: analysis.trackingNumber,
      carrier: analysis.carrier,
      status: analysis.status,
      type: analysis.type,
      sourceEmailId: email.id,
      provider: email.provider,
      title: analysis.title,
      price: analysis.price ?? undefined,
      currency: analysis.currency ?? undefined,
    });
  }

  analyze(email: EmailInput): AnalyzedEmail {
    const cleanedText = this.cleanText(email.body);
    const combinedText = `${email.subject} ${cleanedText}`.toLowerCase();

    const { trackingNumber, carrier } = this.extractTracking(combinedText);
    const type = this.detectType(combinedText);
    const status = this.detectStatus(combinedText);
    const title = this.extractTitle(email.subject);
    const { price, currency } = this.extractPrice(combinedText);

    return {
      trackingNumber,
      carrier,
      type,
      status,
      title,
      price,
      currency,
    };
  }

  private cleanText(html: string): string {
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

  private extractTracking(text: string): { trackingNumber: string | null; carrier: Carrier } {
    for (const { carrier, patterns } of TRACKING_PATTERNS) {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          return { trackingNumber: match[0].toUpperCase(), carrier };
        }
      }
    }
    return { trackingNumber: null, carrier: 'other' };
  }

  private detectType(text: string): ParcelType {
    const saleScore = SALE_KEYWORDS.filter(k => text.includes(k)).length;
    const purchaseScore = PURCHASE_KEYWORDS.filter(k => text.includes(k)).length;
    return saleScore > purchaseScore ? 'sale' : 'purchase';
  }

  private detectStatus(text: string): ParcelStatus {
    for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
      if (keywords.some(k => text.includes(k))) {
        return status as ParcelStatus;
      }
    }
    return 'pending';
  }

  private extractTitle(subject: string): string {
    const cleaned = subject
      .replace(/^(re:|fwd:|fw:)\s*/gi, '')
      .replace(/^\[.*?\]\s*/, '')
      .trim();
    return cleaned.slice(0, 100);
  }

  private extractPrice(text: string): { price: number | null; currency: string | null } {
    const patterns = [
      /(\$|€|£|USD|EUR|GBP)\s*(\d+[.,]?\d*)/i,
      /(\d+[.,]?\d*)\s*(€|\$|£|USD|EUR|GBP)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const priceStr = match[1].match(/\d/) ? match[1] : match[2];
        const currencyStr = match[1].match(/\d/) ? match[2] : match[1];
        
        const price = parseFloat(priceStr.replace(',', '.'));
        const currency = this.normalizeCurrency(currencyStr);
        
        if (!isNaN(price)) {
          return { price, currency };
        }
      }
    }

    return { price: null, currency: null };
  }

  private normalizeCurrency(symbol: string): string {
    const map: Record<string, string> = {
      '$': 'USD',
      '€': 'EUR',
      '£': 'GBP',
    };
    return map[symbol] || symbol.toUpperCase();
  }
}
