import { Injectable } from '@nestjs/common';
import { CarrierDetectorService, CarrierType } from './carriers/carrier-detector.service';
import { VintedGoParserService } from './carriers/vinted-go-parser.service';
import { MondialRelayParserService } from './carriers/mondial-relay-parser.service';
import { ChronopostParserService } from './carriers/chronopost-parser.service';
import { ColissimoParserService } from './carriers/colissimo-parser.service';
import { DHLParserService } from './carriers/dhl-parser.service';
import { UPSParserService } from './carriers/ups-parser.service';
import { FedExParserService } from './carriers/fedex-parser.service';
import { TrackingNumberExtractorService } from './tracking-number-extractor.service';

export interface ParsedTrackingInfo {
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other' | 'vinted_go' | 'mondial_relay' | 'chronopost' | 'dpd' | 'colis_prive' | 'gls' | 'amazon_logistics';
  type?: 'purchase' | 'sale'; // purchase = incoming (you receive), sale = outgoing (you send)
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
    private colissimoParser: ColissimoParserService,
    private dhlParser: DHLParserService,
    private upsParser: UPSParserService,
    private fedexParser: FedExParserService,
    private trackingExtractor: TrackingNumberExtractorService,
  ) {}

  /**
   * Parse email using intelligent multi-layered approach:
   * 1. Detect carrier from email metadata
   * 2. Route to specialized parser if available
   * 3. Use intelligent tracking number extraction as fallback
   * 4. Extract metadata with advanced patterns
   */
  async parseEmail(email: {
    subject: string;
    from: string;
    body: string;
    receivedAt?: Date;
  }): Promise<ParsedTrackingInfo> {
    // Detect carrier from sender/subject/body
    const carrierType = this.carrierDetector.detectCarrier({
      from: email.from,
      subject: email.subject,
      body: email.body,
    });
    
    console.log(`[EmailParsingService] Detected carrier: ${carrierType}`);

    const emailWithDate = {
      ...email,
      receivedAt: email.receivedAt || new Date(),
    };

    // Route to carrier-specific parser
    let result: ParsedTrackingInfo = await this.routeToCarrierParser(carrierType, emailWithDate);

    // If no tracking number found, use intelligent extraction
    if (!result.trackingNumber) {
      const extractedNumber = this.trackingExtractor.extractBestTrackingNumber(
        `${email.subject} ${email.body}`,
      );
      if (extractedNumber) {
        result.trackingNumber = extractedNumber;
        console.log(`[EmailParsingService] Extracted tracking with ML: ${extractedNumber}`);
      }
    }

    // Ensure carrier is set
    if (!result.carrier || result.carrier === 'other') {
      result.carrier = this.mapCarrierTypeToCarrier(carrierType);
    }

    return result;
  }

  /**
   * Route to appropriate carrier-specific parser
   */
  private async routeToCarrierParser(
    carrierType: CarrierType,
    email: { subject: string; from: string; body: string; receivedAt: Date },
  ): Promise<ParsedTrackingInfo> {
    switch (carrierType) {
      case 'vinted_go':
        return this.vintedGoParser.parse(email);

      case 'mondial_relay':
        return this.mondialRelayParser.parse(email);

      case 'chronopost':
        return this.chronopostParser.parse(email);

      case 'colissimo':
      case 'laposte':
        return this.colissimoParser.parse(email);

      case 'dhl':
        return this.dhlParser.parse(email);

      case 'ups':
        return this.upsParser.parse(email);

      case 'fedex':
        return this.fedexParser.parse(email);

      case 'dpd':
      case 'colis_prive':
      case 'gls':
      case 'amazon_logistics':
      case 'other':
      default:
        return this.parseGeneric(email);
    }
  }

  /**
   * Map CarrierType to carrier string for ParsedTrackingInfo
   */
  private mapCarrierTypeToCarrier(
    carrierType: CarrierType,
  ): 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other' | 'vinted_go' | 'mondial_relay' | 'chronopost' | 'dpd' | 'colis_prive' | 'gls' | 'amazon_logistics' {
    const mapping: Record<CarrierType, ParsedTrackingInfo['carrier']> = {
      vinted_go: 'vinted_go',
      mondial_relay: 'mondial_relay',
      chronopost: 'chronopost',
      colissimo: 'colissimo',
      laposte: 'laposte',
      dhl: 'dhl',
      ups: 'ups',
      fedex: 'fedex',
      dpd: 'dpd',
      colis_prive: 'colis_prive',
      gls: 'gls',
      amazon_logistics: 'amazon_logistics',
      other: 'other',
    };
    return mapping[carrierType] || 'other';
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
