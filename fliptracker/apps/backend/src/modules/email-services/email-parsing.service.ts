import { Injectable } from '@nestjs/common';

export interface ParsedTrackingInfo {
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other';
  qrCode?: string;
  withdrawalCode?: string;
  articleId?: string;
  marketplace?: string;
}

@Injectable()
export class EmailParsingService {
  /**
   * Parse email to extract tracking information
   */
  async parseEmail(email: {
    subject: string;
    from: string;
    body: string;
  }): Promise<ParsedTrackingInfo> {
    const result: ParsedTrackingInfo = {};

    // 1. Extract tracking number (common patterns)
    const trackingPatterns = [
      /(?:tracking|suivi|numéro)[\s:]*([A-Z0-9]{8,20})/gi,
      /[A-Z]{2}\d{9}[A-Z]{2}/g, // UPS format
      /1Z[A-Z0-9]{16}/g, // UPS format 2
      /\d{20,30}/g, // Long numbers
    ];

    for (const pattern of trackingPatterns) {
      const match = email.body.match(pattern) || email.subject.match(pattern);
      if (match) {
        result.trackingNumber = match[0];
        break;
      }
    }

    // 2. Extract QR code (if present)
    const qrPattern = /(?:qr code|code qr|qr)[\s:]*([A-Z0-9]{10,50})/gi;
    const qrMatch = email.body.match(qrPattern);
    if (qrMatch) {
      result.qrCode = qrMatch[0].split(':')[1]?.trim();
    }

    // 3. Extract withdrawal/pickup code (for parcel points)
    const withdrawalPatterns = [
      /(?:code|numéro)[\s]*(?:de[\s])?(?:retrait|retrait|pickup)[\s:]*([A-Z0-9]{4,10})/gi,
      /(?:retrait|pickup)[\s:]*([A-Z0-9]{4,10})/gi,
    ];

    for (const pattern of withdrawalPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.withdrawalCode = match[0].split(':')[1]?.trim();
        break;
      }
    }

    // 4. Extract article ID
    const articlePatterns = [
      /(?:article|produit|ref)[\s]*:?\s*([A-Z0-9]{6,15})/gi,
      /(?:sku|asin)[\s]*:?\s*([A-Z0-9]{6,15})/gi,
    ];

    for (const pattern of articlePatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.articleId = match[0].split(':')[1]?.trim();
        break;
      }
    }

    // 5. Guess marketplace from sender or subject
    const combined = `${email.subject} ${email.from}`.toLowerCase();
    if (combined.includes('amazon')) result.marketplace = 'amazon';
    else if (combined.includes('ebay')) result.marketplace = 'ebay';
    else if (combined.includes('aliexpress')) result.marketplace = 'aliexpress';
    else if (combined.includes('cdiscount')) result.marketplace = 'cdiscount';
    else if (combined.includes('fnac')) result.marketplace = 'fnac';

    // 6. Guess carrier
    if (combined.includes('dhl')) result.carrier = 'dhl';
    else if (combined.includes('ups')) result.carrier = 'ups';
    else if (combined.includes('fedex')) result.carrier = 'fedex';
    else if (combined.includes('laposte') || combined.includes('colissimo')) result.carrier = 'laposte';
    else result.carrier = 'other';

    return result;
  }
}
