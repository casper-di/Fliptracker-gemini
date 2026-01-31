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
export class VintedGoParserService {
  /**
   * Parse Vinted Go emails
   * Pattern: Tracking number in subject: #XXXXXXXX
   * Code de retrait: Found after "code suivant:"
   */
  parse(email: { subject: string; body: string; from: string }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      marketplace: 'vinted',
      carrier: 'vinted_go',
    };

    // Extract tracking number from subject: "Il est temps de récupérer ton colis ! #1761843602574816"
    const subjectMatch = email.subject.match(/#(\d{16,20})/);
    if (subjectMatch) {
      result.trackingNumber = subjectMatch[1];
    }

    // Extract withdrawal code from body: "code suivant : <b>N30681</b>"
    const withdrawalPatterns = [
      /code\s+suivant\s*:\s*<b>([A-Z0-9]+)<\/b>/gi,
      /code\s+suivant\s*:\s*\*\*([A-Z0-9]+)\*\*/gi,
      /code\s+suivant\s*:\s*([A-Z0-9]{4,10})/gi,
    ];

    for (const pattern of withdrawalPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.withdrawalCode = match[1] || match[0].split(':')[1]?.trim().replace(/<[^>]*>/g, '').replace(/\*\*/g, '') || null;
        break;
      }
    }

    console.log(`[VintedGoParser] Parsed:`, {
      trackingNumber: result.trackingNumber,
      withdrawalCode: result.withdrawalCode,
    });

    return result;
  }
}
