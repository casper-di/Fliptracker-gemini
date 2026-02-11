import { Injectable } from '@nestjs/common';
import { CarrierDetectorService, CarrierType } from './carriers/carrier-detector.service';
import { VintedGoParserService } from './carriers/vinted-go-parser.service';
import { MondialRelayParserService } from './carriers/mondial-relay-parser.service';
import { RelaisColisParserService } from './carriers/relais-colis-parser.service';
import { ChronopostParserService } from './carriers/chronopost-parser.service';
import { ColissimoParserService } from './carriers/colissimo-parser.service';
import { DHLParserService } from './carriers/dhl-parser.service';
import { UPSParserService } from './carriers/ups-parser.service';
import { FedExParserService } from './carriers/fedex-parser.service';
import { TrackingNumberExtractorService } from './tracking-number-extractor.service';
import { ShipmentTypeDetectorService } from './shipment-type-detector.service';
import { AddressExtractorService } from './utils/address-extractor.service';

export interface ParsedTrackingInfo {
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other' | 'vinted_go' | 'mondial_relay' | 'relais_colis' | 'chronopost' | 'dpd' | 'colis_prive' | 'gls' | 'amazon_logistics';
  type?: 'purchase' | 'sale'; // purchase = incoming (you receive), sale = outgoing (you send)
  qrCode?: string | null;
  withdrawalCode?: string | null;
  articleId?: string | null;
  marketplace?: string | null;
  // Email classification (NEW)
  emailType?: 'order_confirmed' | 'label_created' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'pickup_ready' | 'returned' | 'info' | 'promo' | 'unknown';
  sourceType?: 'platform' | 'carrier' | 'unknown';
  sourceName?: string | null;
  classificationConfidence?: number | null;
  labelUrl?: string | null;
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
    private shipmentTypeDetector: ShipmentTypeDetectorService,
    private vintedGoParser: VintedGoParserService,
    private mondialRelayParser: MondialRelayParserService,
    private relaisColisParser: RelaisColisParserService,
    private chronopostParser: ChronopostParserService,
    private colissimoParser: ColissimoParserService,
    private dhlParser: DHLParserService,
    private upsParser: UPSParserService,
    private fedexParser: FedExParserService,
    private trackingExtractor: TrackingNumberExtractorService,
    private addressExtractor: AddressExtractorService,
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

      case 'relais_colis':
        return this.relaisColisParser.parse(email);

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
  ): 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other' | 'vinted_go' | 'mondial_relay' | 'relais_colis' | 'chronopost' | 'dpd' | 'colis_prive' | 'gls' | 'amazon_logistics' {
    const mapping: Record<CarrierType, ParsedTrackingInfo['carrier']> = {
      vinted_go: 'vinted_go',
      mondial_relay: 'mondial_relay',
      relais_colis: 'relais_colis',
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
    const result: ParsedTrackingInfo = { 
      marketplace: null, 
      carrier: 'other',
      type: this.shipmentTypeDetector.detectType(email),
    };

    // Strip HTML for text-based regex matching
    const strippedBody = this.stripHTML(email.body);
    const combined = `${email.subject}\n${strippedBody}`;

    // 1. Extract tracking number (common patterns) — use capture groups
    const trackingExtractors: { pattern: RegExp; group: number }[] = [
      // Explicit tracking/suivi label followed by alphanumeric code
      { pattern: /(?:tracking|suivi|numéro de suivi)[\s:#]*([A-Z0-9]{8,30})/gi, group: 1 },
      // International postal format: XX123456789XX
      { pattern: /\b([A-Z]{2}\d{9}[A-Z]{2})\b/g, group: 1 },
      // UPS format: 1Z...
      { pattern: /\b(1Z[A-Z0-9]{16})\b/g, group: 1 },
      // Chronopost format: XW/XS + digits + 2 letters
      { pattern: /\b(X[WS]\d{9,11}[A-Z]{2})\b/g, group: 1 },
      // Colissimo format
      { pattern: /\b([6-8][AV]\d{11})\b/g, group: 1 },
      // GOFO format
      { pattern: /\b(GFFR\d{10,20})\b/gi, group: 1 },
      // Generic long digit tracking (13-22 digits) — but NOT inside URLs
      { pattern: /(?<![\/=&?])\b(\d{13,22})\b(?![\/=&?])/g, group: 1 },
    ];

    for (const { pattern, group } of trackingExtractors) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0; // Reset regex state
      while ((match = pattern.exec(combined)) !== null) {
        const candidate = match[group]?.trim();
        if (candidate && this.isValidTrackingNumber(candidate)) {
          result.trackingNumber = candidate;
          break;
        }
      }
      if (result.trackingNumber) break;
    }

    // 2. Extract QR code (if present)
    const qrPattern = /(?:qr code|code qr|qr)[\s:]*([A-Z0-9]{10,50})/gi;
    const qrMatch = strippedBody.match(qrPattern);
    if (qrMatch) {
      result.qrCode = qrMatch[0].split(':')[1]?.trim() || null;
    }

    // 3. Extract withdrawal/pickup code (for parcel points)
    const withdrawalPatterns = [
      /(?:code|numéro)[\s]*(?:de[\s])?(?:retrait|pickup)[\s:]+([A-Z0-9]{4,10})/gi,
      /(?:retrait|pickup)[\s:]+([A-Z0-9]{4,10})/gi,
    ];

    for (const pattern of withdrawalPatterns) {
      const match = strippedBody.match(pattern);
      if (match && match[1]) {
        result.withdrawalCode = match[1].trim();
        break;
      }
    }

    // 4. Detect marketplace from subject+from
    const combinedMeta = `${email.subject} ${email.from}`.toLowerCase();
    if (combinedMeta.includes('amazon')) result.marketplace = 'amazon';
    else if (combinedMeta.includes('ebay')) result.marketplace = 'ebay';
    else if (combinedMeta.includes('aliexpress')) result.marketplace = 'aliexpress';
    else if (combinedMeta.includes('cdiscount')) result.marketplace = 'cdiscount';
    else if (combinedMeta.includes('fnac')) result.marketplace = 'fnac';
    else if (combinedMeta.includes('shein')) result.marketplace = 'shein';
    else if (combinedMeta.includes('temu')) result.marketplace = 'temu';
    else if (combinedMeta.includes('zalando')) result.marketplace = 'zalando';
    else if (combinedMeta.includes('rakuten')) result.marketplace = 'rakuten';

    // 5. Detect carrier from subject+from
    if (combinedMeta.includes('dhl')) result.carrier = 'dhl';
    else if (combinedMeta.includes('ups')) result.carrier = 'ups';
    else if (combinedMeta.includes('fedex')) result.carrier = 'fedex';
    else if (combinedMeta.includes('laposte') || combinedMeta.includes('colissimo')) result.carrier = 'laposte';

    // 6. Extract pickup address
    result.pickupAddress = this.addressExtractor.extractAddress(email.body);

    return result;
  }

  /**
   * Validate that a string is actually a tracking number and not random text
   */
  private isValidTrackingNumber(candidate: string): boolean {
    // Reject if it contains common words
    const lower = candidate.toLowerCase();
    const rejectWords = ['tracking', 'information', 'suivi', 'livraison', 'details', 'number', 'numéro', 'colis'];
    if (rejectWords.some(w => lower.includes(w))) return false;
    
    // Reject if all same digit (e.g., 333333333333336)
    if (/^(\d)\1{10,}$/.test(candidate)) return false;
    
    // Must be at least 8 chars
    if (candidate.length < 8) return false;
    
    // Must contain at least some digits
    if (!/\d/.test(candidate)) return false;
    
    return true;
  }

  private stripHTML(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(?:p|div|tr|td|h[1-6]|li)>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
