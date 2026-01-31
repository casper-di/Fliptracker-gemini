import { Injectable } from '@nestjs/common';

export interface ParsedTrackingInfo {
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other' | 'vinted_go' | 'mondial_relay' | 'chronopost';
  qrCode?: string | null;
  withdrawalCode?: string | null;
  articleId?: string | null;
  marketplace?: string | null;
  // New fields
  productName?: string | null;
  productDescription?: string | null;
  recipientName?: string | null;
  pickupAddress?: string | null;
  pickupDeadline?: Date | null;
}

@Injectable()
export class ChronopostParserService {
  /**
   * Parse Chronopost Pickup emails
   */
  parse(email: { subject: string; body: string; from: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      marketplace: 'vinted',
      carrier: 'chronopost',
    };

    // Extract tracking number - Chronopost format: XW261547816TS
    const trackingPatterns = [
      /colis[^<]*<[^>]*>([A-Z]{2}\d{9}[A-Z]{2})/i,
      /Votre colis VINTED n.*?<a[^>]*>([A-Z0-9]{10,})/i,
      /numéro.*?([A-Z]{2}\d{9}[A-Z]{2})/i,
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
    ];

    for (const pattern of withdrawalPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.withdrawalCode = match[1];
        break;
      }
    }

    // Extract recipient name from greeting
    const recipientMatch = email.body.match(/Bonjour\s+([A-Z][A-Z\s]*)\s*!/i);
    if (recipientMatch) {
      result.recipientName = recipientMatch[1]?.trim() || null;
    }

    // Extract pickup address
    const addressMatch = email.body.match(/Votre relais Pickup[\s\S]*?<strong>([^<]+)<\/strong>[\s\S]*?(\d+.*?[A-Z\s]+)/i);
    if (addressMatch) {
      result.pickupAddress = `${addressMatch[1]?.trim()}, ${addressMatch[2]?.trim()}` || null;
    }

    // Extract pickup deadline
    const deadlinePatterns = [
      /jusqu'au\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i,
      /available[\s\S]*?(\d{1,2})\s+(\w+)\s+(\d{4})/i,
    ];

    for (const pattern of deadlinePatterns) {
      const match = email.body.match(pattern);
      if (match) {
        try {
          const [, day, month, year] = match;
          result.pickupDeadline = new Date(`${year}-${month}-${day}`) || null;
        } catch (e) {
          // Ignore parsing errors
        }
        break;
      }
    }

    console.log(`[ChronopostParser] Parsed:`, {
      trackingNumber: result.trackingNumber,
      withdrawalCode: result.withdrawalCode,
      recipientName: result.recipientName,
      pickupAddress: result.pickupAddress,
      pickupDeadline: result.pickupDeadline,
    });

    return result;
  }
}
