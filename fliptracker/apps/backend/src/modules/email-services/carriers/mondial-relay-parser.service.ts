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
export class MondialRelayParserService {
  /**
   * Parse Mondial Relay / Relais Colis emails
   * Pattern 1 (Relais Colis): Reference "VD3000015539" in body
   * Pattern 2 (Mondial Relay): "VINTED 49022413" format
   * Withdrawal code: Large numeric code (usually 6 digits)
   */
  parse(email: { subject: string; body: string; from: string }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      marketplace: 'vinted',
      carrier: 'mondial_relay',
    };

    // Pattern 1: Reference like "VD3000015539" or "VINTED <number>"
    const refPatterns = [
      /VD(\d{10,})/i, // "VD3000015539"
      /VINTED\s+(\d{8,})/i, // "VINTED 49022413"
      /Référence.*?<b>([A-Z0-9]{10,})/i, // HTML formatted
      /référence.*?(\d{8,})/i, // French text
    ];

    for (const pattern of refPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.trackingNumber = match[1] || match[0];
        break;
      }
    }

    // Extract withdrawal code - typically 6 digits, often styled large
    const withdrawalPatterns = [
      /Code de retrait[\s\S]*?(\d{6})/i,
      /code\s+de\s+retrait[\s:]*<[^>]*>[\s\S]*?(\d{6})/i,
      /<span[^>]*>\s*(\d{6})\s*<\/span>/i,
      /font-size:\s*48px[^>]*>(\d{6})</i,
      /font-weight:\s*700[^>]*>(\d{6})</i,
    ];

    for (const pattern of withdrawalPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.withdrawalCode = match[1];
        break;
      }
    }

    // Fallback: extract any 6-digit code that looks significant
    if (!result.withdrawalCode) {
      const fallbackMatch = email.body.match(/(\d{6})/);
      if (fallbackMatch) {
        result.withdrawalCode = fallbackMatch[1];
      }
    }

    console.log(`[MondialRelayParser] Parsed:`, {
      trackingNumber: result.trackingNumber,
      withdrawalCode: result.withdrawalCode,
    });

    return result;
  }
}
