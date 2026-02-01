import { Injectable } from '@nestjs/common';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';

export interface ParsedTrackingInfo {
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other' | 'vinted_go' | 'mondial_relay' | 'chronopost';
  type?: 'purchase' | 'sale';
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
export class MondialRelayParserService {
  /**
   * Parse Mondial Relay / Relais Colis emails
   */
  parse(email: { subject: string; body: string; from: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      marketplace: 'vinted',
      carrier: 'mondial_relay',
    };

    // Pattern 1: Reference like "VD3000015539" or "VINTED <number>"
    const refPatterns = [
      /VD(\d{10,})/i,
      /VINTED\s+(\d{8,})/i,
      /Référence.*?<b>([A-Z0-9]{10,})/i,
    ];

    for (const pattern of refPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.trackingNumber = match[1] || match[0];
        break;
      }
    }

    // Extract withdrawal code - typically 6 digits
    const withdrawalPatterns = [
      /Code de retrait[\s\S]*?(\d{6})/i,
      /code\s+de\s+retrait[\s:]*<[^>]*>[\s\S]*?(\d{6})/i,
      /<span[^>]*>\s*(\d{6})\s*<\/span>/i,
    ];

    for (const pattern of withdrawalPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.withdrawalCode = match[1];
        break;
      }
    }

    // Fallback: extract any 6-digit code
    if (!result.withdrawalCode) {
      const fallbackMatch = email.body.match(/(\d{6})/);
      if (fallbackMatch) {
        result.withdrawalCode = fallbackMatch[1];
      }
    }

    // Extract recipient name (usually in greeting or pickup section)
    const recipientPatterns = [
      /Bonjour\s+([A-Z][A-Z\s]+)\s*!/i,
      /Hello\s+([A-Z][A-Z\s]+)\s*!/i,
    ];

    for (const pattern of recipientPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.recipientName = match[1]?.trim() || null;
        break;
      }
    }

    // Extract pickup address - comprehensive extraction
    let pickupAddress: string | null = null;
    
    // Try to extract from table or structured content
    const addressTableMatch = email.body.match(/adresse[\s\S]*?<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    if (addressTableMatch) {
      pickupAddress = addressTableMatch[1]
        .replace(/<br\s*\/?>/gi, ', ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/,\s*,/g, ',')
        .replace(/,\s*$/g, '');
    }
    
    // Fallback: try strong tags pattern
    if (!pickupAddress) {
      const addressMatch = email.body.match(/<strong>([^<]+)<\/strong>[\s\S]*?(\d+.*?(?:OULLINS|LYON|PARIS|MARSEILLE|\d{5})[^<]*)/i);
      if (addressMatch) {
        pickupAddress = `${addressMatch[1]?.trim()}, ${addressMatch[2]?.trim()}`;
      }
    }
    
    result.pickupAddress = pickupAddress || null;

    // Extract pickup deadline
    const deadlinePatterns = [
      /jusqu'(?:au|à)\s+(?:vendredi\s+)?(\d{1,2})\s+(?:novembre|january|january|février|mars|avril|mai|juin|juillet|août|septembre|octobre|décembre)/i,
      /available[\s\S]*?until[\s\S]*?(\d{1,2})\s+(\w+)\s+(\d{4})/i,
    ];

    for (const pattern of deadlinePatterns) {
      const match = email.body.match(pattern);
      if (match) {
        try {
          // Try to parse the date
          const dateStr = match[1];
          if (dateStr) {
            result.pickupDeadline = new Date(dateStr) || null;
          }
        } catch (e) {
          // Ignore parsing errors
        }
        break;
      }
    }

    console.log(`[MondialRelayParser] Parsed:`, {
      trackingNumber: result.trackingNumber,
      withdrawalCode: result.withdrawalCode,
      recipientName: result.recipientName,
      pickupAddress: result.pickupAddress,
      pickupDeadline: result.pickupDeadline,
    });

    return result;
  }
}
