import { Injectable } from '@nestjs/common';
import { CarrierDetectorService } from './carriers/carrier-detector.service';
import { VintedGoParserService } from './carriers/vinted-go-parser.service';
import { MondialRelayParserService } from './carriers/mondial-relay-parser.service';
import { ChronopostParserService } from './carriers/chronopost-parser.service';

export interface ParsedTrackingInfo {
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other' | 'vinted_go' | 'mondial_relay' | 'chronopost';
  qrCode?: string | null;
  withdrawalCode?: string | null;
  articleId?: string | null;
  marketplace?: string | null;
  // Metadata fields
  productName?: string | null;
  productDescription?: string | null;
  recipientName?: string | null;
  senderName?: string | null;
  pickupAddress?: string | null;
  pickupDeadline?: Date | null;
  orderNumber?: string | null;
  estimatedValue?: number | null;
  currency?: string | null;
}

@Injectable()
export class EmailParsingService {
  constructor(
    private carrierDetector: CarrierDetectorService,
    private vintedGoParser: VintedGoParserService,
    private mondialRelayParser: MondialRelayParserService,
    private chronopostParser: ChronopostParserService,
  ) {}

  /**
   * Parse email using carrier-specific parsers
   * Falls back to generic parsing for unknown carriers
   */
  async parseEmail(email: {
    subject: string;
    from: string;
    body: string;
    receivedAt?: Date;
  }): Promise<ParsedTrackingInfo> {
    // Detect carrier from sender/subject
    const carrierType = this.carrierDetector.detectCarrier(email);
    console.log(`[EmailParsingService] Detected carrier: ${carrierType}`);

    // Route to carrier-specific parser
    let result: ParsedTrackingInfo = {};

    const emailWithDate = {
      ...email,
      receivedAt: email.receivedAt || new Date(),
    };

    switch (carrierType) {
      case 'vinted_go':
        result = this.vintedGoParser.parse(emailWithDate);
        break;

      case 'mondial_relay':
        result = this.mondialRelayParser.parse(emailWithDate);
        break;

      case 'chronopost':
        result = this.chronopostParser.parse(emailWithDate);
        break;

      case 'other':
      default:
        result = this.parseGeneric(email);
        break;
    }

    return result;
  }

  /**
   * Fallback generic parser for unknown carriers
   */
  private parseGeneric(email: { subject: string; from: string; body: string }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = { marketplace: null, carrier: 'other' };

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
      result.qrCode = qrMatch[0].split(':')[1]?.trim() || null;
    }

    // 3. Extract withdrawal/pickup code (for parcel points)
    const withdrawalPatterns = [
      /(?:code|numéro)[\s]*(?:de[\s])?(?:retrait|retrait|pickup)[\s:]*([A-Z0-9]{4,10})/gi,
      /(?:retrait|pickup)[\s:]*([A-Z0-9]{4,10})/gi,
    ];

    for (const pattern of withdrawalPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.withdrawalCode = match[0].split(':')[1]?.trim() || null;
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
        result.articleId = match[0].split(':')[1]?.trim() || null;
        break;
      }
    }

    // 5. Detect marketplace
    const combined = `${email.subject} ${email.from}`.toLowerCase();
    if (combined.includes('amazon')) result.marketplace = 'amazon';
    else if (combined.includes('ebay')) result.marketplace = 'ebay';
    else if (combined.includes('aliexpress')) result.marketplace = 'aliexpress';
    else if (combined.includes('cdiscount')) result.marketplace = 'cdiscount';
    else if (combined.includes('fnac')) result.marketplace = 'fnac';

    // 6. Detect carrier
    if (combined.includes('dhl')) result.carrier = 'dhl';
    else if (combined.includes('ups')) result.carrier = 'ups';
    else if (combined.includes('fedex')) result.carrier = 'fedex';
    else if (combined.includes('laposte') || combined.includes('colissimo')) result.carrier = 'laposte';

    return result;
  }
}
