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
export class VintedGoParserService {
  /**
   * Parse Vinted Go emails
   */
  parse(email: { subject: string; body: string; from: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      marketplace: 'vinted',
      carrier: 'vinted_go',
    };

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

    // Extract pickup address
    const addressMatch = email.body.match(/Adresse[\s\S]*?<b>\s*([^<]+)\s*<\/b>[\s\S]*?<b>\s*([^<]+)\s*<\/b>/);
    if (addressMatch) {
      const address = `${addressMatch[1]?.trim() || ''}, ${addressMatch[2]?.trim() || ''}`.replace(/,\s*$/, '');
      result.pickupAddress = address || null;
    }

    // Extract recipient name from greeting (after "Bonjour")
    const recipientMatch = email.body.match(/Bonjour\s+([^,<]+)/i);
    if (recipientMatch) {
      result.recipientName = recipientMatch[1]?.trim() || null;
    }

    console.log(`[VintedGoParser] Parsed:`, {
      trackingNumber: result.trackingNumber,
      withdrawalCode: result.withdrawalCode,
      productName: result.productName,
      recipientName: result.recipientName,
      pickupDeadline: result.pickupDeadline,
    });

    return result;
  }
}
