import { Injectable } from '@nestjs/common';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';
import { AddressExtractorService } from '../utils/address-extractor.service';
import { TrackingValidatorService } from '../utils/tracking-validator.service';
import { DateParserService } from '../utils/date-parser.service';
import { QRCodeExtractorService } from '../utils/qr-code-extractor.service';
import { MarketplaceDetectorService } from '../utils/marketplace-detector.service';
import { WithdrawalCodeExtractorService } from '../utils/withdrawal-code-extractor.service';

export interface ParsedTrackingInfo {
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other' | 'vinted_go' | 'mondial_relay' | 'chronopost';
  type?: 'purchase' | 'sale';
  qrCode?: string | null;
  withdrawalCode?: string | null;
  articleId?: string | null;
  marketplace?: string | null;
  productName?: string | null;
  productDescription?: string | null;
  recipientName?: string | null;
  senderName?: string | null;
  pickupAddress?: string | null;
  pickupDeadline?: Date | null;
}

@Injectable()
export class ChronopostParserService {
  constructor(
    private shipmentTypeDetector: ShipmentTypeDetectorService,
    private addressExtractor: AddressExtractorService,
    private trackingValidator: TrackingValidatorService,
    private dateParser: DateParserService,
    private qrCodeExtractor: QRCodeExtractorService,
    private marketplaceDetector: MarketplaceDetectorService,
    private withdrawalCodeExtractor: WithdrawalCodeExtractorService,
  ) {}

  /**
   * Validate Chronopost tracking format (e.g., XW250342935TS, 3436603419)
   */
  private isValidTrackingNumber(tracking: string | null): boolean {
    if (!tracking) return false;
    // Format 1: Letters + digits + letters (e.g., XW250342935TS)
    // Format 2: 10 digits (e.g., 3436603419)
    return /^[A-Z]{2}\d{9,11}[A-Z]{2}$/i.test(tracking) || /^\d{10}$/.test(tracking);
  }

  /**
   * Parse Chronopost emails
   */
  parse(email: { subject: string; body: string; from: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      marketplace: this.marketplaceDetector.detectMarketplace(email),
      carrier: 'chronopost',
      type: this.shipmentTypeDetector.detectType(email),
    };

    // Extract QR code using robust extractor (only for incoming/pickup emails)
    if (result.type === 'purchase') {
      result.qrCode = this.qrCodeExtractor.extractQRCode(email.body);
    }

    // Extract tracking number - Chronopost format: XW250342935TS or 3436603419
    const trackingPatterns = [
      /Votre colis VINTED n°?\s*<a[^>]*>([A-Z0-9]{10,})<\/a>/i,
      /(?:colis|tracking|suivi)[^<]{0,50}<[^>]*>([A-Z]{2}\d{9,11}[A-Z]{2})/i,
      /(?:numéro|numero|tracking|suivi)[\s:°]*([A-Z]{2}\d{9,11}[A-Z]{2})/i,
      /\b([A-Z]{2}\d{9,11}[A-Z]{2})\b/, // Generic format
      /\b(\d{10})\b/, // 10-digit tracking numbers
    ];

    for (const pattern of trackingPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        const candidate = match[1];
        if (this.isValidTrackingNumber(candidate)) {
          result.trackingNumber = candidate;
          break;
        }
      }
    }

    // Extract withdrawal code using specialized extractor
    result.withdrawalCode = this.withdrawalCodeExtractor.extractCode(email.body, email.body);

    // Extract recipient/sender name from greeting
    const greetingMatch = email.body.match(/Bonjour\s+([A-Z][a-zA-Z\s'-]+)(?:\s*!|\s*<)/i);
    if (greetingMatch?.[1]) {
      const name = greetingMatch[1].trim();
      if (result.type === 'sale') {
        result.senderName = name;
      } else {
        result.recipientName = name;
      }
    }

    // Extract pickup address using comprehensive extractor
    result.pickupAddress = this.addressExtractor.extractAddress(email.body);

    // Extract pickup deadline using smart parser
    result.pickupDeadline = this.dateParser.parseDate(email.body, email.receivedAt);

    return result;
  }
}
