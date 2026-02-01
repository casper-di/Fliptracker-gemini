import { Injectable } from '@nestjs/common';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';

export interface ParsedTrackingInfo {
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other' | 'vinted_go' | 'mondial_relay' | 'chronopost';
  qrCode?: string | null;
  withdrawalCode?: string | null;
  articleId?: string | null;
  marketplace?: string | null;
  type?: 'purchase' | 'sale'; // NEW: distinguish incoming vs outgoing
  // New fields
  productName?: string | null;
  productDescription?: string | null;
  recipientName?: string | null;
  pickupAddress?: string | null;
  pickupDeadline?: Date | null;
}

@Injectable()
export class VintedGoParserService {
  constructor(private shipmentTypeDetector: ShipmentTypeDetectorService) {}

  /**
   * Parse Vinted Go emails
   */
  parse(email: { subject: string; body: string; from: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      marketplace: 'vinted',
      carrier: 'vinted_go',
    };

    // Detect type using universal detector
    result.type = this.shipmentTypeDetector.detectType(email);

    // Extract tracking number from subject: "Il est temps de récupérer ton colis ! #1761843602574816"
    const subjectMatch = email.subject.match(/#(\d{16,20})/);
    if (subjectMatch) {
      result.trackingNumber = subjectMatch[1];
    }

    // Extract withdrawal code
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

    // Extract product name from "Détails de la commande" section
    const productMatch = email.body.match(/<b>([^<]+)<br[^>]*>\d+\.\d+\s*€/);
    if (productMatch) {
      result.productName = productMatch[1]?.trim().replace(/…/, '...') || null;
    }

    // Extract pickup deadline
    const deadlineMatch = email.body.match(/À retirer avant le[\s\S]*?<b>(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (deadlineMatch) {
      const [day, month, year] = deadlineMatch[1].split('/');
      result.pickupDeadline = new Date(`${year}-${month}-${day}`) || null;
    }

    // Extract pickup address - capture all text between "Adresse" and next section
    let pickupAddress: string | null = null;
    const addressSectionMatch = email.body.match(/Adresse[\s\S]*?<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    if (addressSectionMatch) {
      // Extract all text, remove HTML tags, clean up whitespace
      const rawAddress = addressSectionMatch[1]
        .replace(/<br\s*\/?>/gi, ', ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/,\s*,/g, ',')
        .replace(/,\s*$/g, '');
      pickupAddress = rawAddress || null;
    }
    
    // Fallback: try to match bold elements
    if (!pickupAddress) {
      const addressMatch = email.body.match(/Adresse[\s\S]*?<b>\s*([^<]+)\s*<\/b>[\s\S]*?<b>\s*([^<]+)\s*<\/b>/);
      if (addressMatch) {
        pickupAddress = `${addressMatch[1]?.trim() || ''}, ${addressMatch[2]?.trim() || ''}`.replace(/,\s*$/, '') || null;
      }
    }
    
    result.pickupAddress = pickupAddress;

    // Extract recipient name from greeting (after "Bonjour")
    const recipientMatch = email.body.match(/Bonjour\s+([^,<]+)/i);
    if (recipientMatch) {
      result.recipientName = recipientMatch[1]?.trim() || null;
    }

    console.log(`[VintedGoParser] Parsed:`, {
      trackingNumber: result.trackingNumber,
      type: result.type,
      withdrawalCode: result.withdrawalCode,
      productName: result.productName,
      recipientName: result.recipientName,
      pickupDeadline: result.pickupDeadline,
    });

    return result;
  }
}
