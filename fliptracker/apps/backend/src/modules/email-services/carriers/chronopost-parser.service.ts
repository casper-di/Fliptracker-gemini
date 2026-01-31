import { Injectable } from '@nestjs/common';

export interface ParsedTrackingInfo {
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other' | 'vinted_go' | 'mondial_relay' | 'chronopost';
  qrCode?: string | null;
  withdrawalCode?: string | null;
  articleId?: string | null;
  marketplace?: string | null;
}

@Injectable()
export class ChronopostParserService {
  /**
   * Parse Chronopost Pickup emails
   * Tracking number: Format like "XW261547816TS"
   * Withdrawal code: 6-digit numeric code
   */
  parse(email: { subject: string; body: string; from: string }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      marketplace: 'vinted',
      carrier: 'chronopost',
    };

    // Extract tracking number - Chronopost format: XW261547816TS
    const trackingPatterns = [
      /colis[^<]*<[^>]*>([A-Z]{2}\d{9}[A-Z]{2})/i, // In HTML tags
      /colis.*?(\d{16,20})/i, // Long numbers
      /numéro.*?([A-Z]{2}\d{9}[A-Z]{2})/i,
      /Votre colis VINTED n.*?<a[^>]*>([A-Z0-9]{10,})/i,
    ];

    for (const pattern of trackingPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.trackingNumber = match[1];
        break;
      }
    }

    // Extract withdrawal code - typically 6 digits
    const withdrawalPatterns = [
      /Code de retrait[\s\S]*?(\d{6})/i,
      /<span[^>]*>(\d{6})<\/span>/i,
      /font-size:\s*30px[^>]*>(\d{6})</i,
      /letter-spacing:\s*4px[^>]*>(\d{6})</i,
    ];

    for (const pattern of withdrawalPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.withdrawalCode = match[1];
        break;
      }
    }

    console.log(`[ChronopostParser] Parsed:`, {
      trackingNumber: result.trackingNumber,
      withdrawalCode: result.withdrawalCode,
    });

    return result;
  }
}
