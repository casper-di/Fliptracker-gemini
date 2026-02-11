import { Injectable } from '@nestjs/common';
import { ParsedTrackingInfo } from '../email-parsing.service';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';
import { TrackingValidatorService } from '../utils/tracking-validator.service';
import { DateParserService } from '../utils/date-parser.service';
import { AddressExtractorService } from '../utils/address-extractor.service';

/**
 * Parser spécialisé pour DHL Express et DHL Parcel
 */
@Injectable()
export class DHLParserService {
  constructor(
    private shipmentTypeDetector: ShipmentTypeDetectorService,
    private trackingValidator: TrackingValidatorService,
    private dateParser: DateParserService,
    private addressExtractor: AddressExtractorService,
  ) {}

  /**
   * Parse un email DHL pour extraire les informations de livraison
   */
  parse(email: { subject: string; from: string; body: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      carrier: 'dhl',
      marketplace: null,
      type: this.shipmentTypeDetector.detectType(email),
    };

    const body = this.stripHTML(email.body).toLowerCase();
    const bodyOriginal = this.stripHTML(email.body);
    const htmlBody = email.body; // Keep HTML for address extractor

    // 1. Extraction du numéro de suivi DHL
    // Formats DHL:
    // - Express: 10 chiffres (1234567890)
    // - eCommerce: Commence par GM, LX, RX, ou JD (ex: GM12345678901234)
    // - Parcel: Format variable 12-20 chiffres
    const trackingPatterns = [
      /(?:tracking|waybill|awb|shipment)[\s#:]*(\d{10,11})/gi,
      /(?:tracking|waybill|awb)[\s#:]*([A-Z]{2}\d{12,16})/gi,
      /([A-Z]{2}\d{12,16})/g, // Format eCommerce
      /\b(\d{10,11})\b/g, // Format Express (10-11 chiffres)
    ];

    for (const pattern of trackingPatterns) {
      const matches = bodyOriginal.match(pattern);
      if (matches) {
        for (const match of matches) {
          const cleaned = match.replace(/(?:tracking|waybill|awb|shipment)[\s#:]*/gi, '').trim();
          
          // Validate DHL format using utility
          if (this.trackingValidator.validateTracking(cleaned, 'dhl')) {
            result.trackingNumber = cleaned;
            break;
          }
        }
        if (result.trackingNumber) break;
      }
    }

    // 2. Extraction du nom du destinataire
    const recipientPatterns = [
      /(?:dear|hello|bonjour|hi)[\s]*([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)/gi,
      /recipient[\s:]*([A-Z][a-zA-ZÀ-ÿ]+\s+[A-Z][a-zA-ZÀ-ÿ]+)/gi,
      /destinataire[\s:]*([A-Z][a-zA-ZÀ-ÿ]+\s+[A-Z][a-zA-ZÀ-ÿ]+)/gi,
    ];

    for (const pattern of recipientPatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        result.recipientName = match[1].trim();
        break;
      }
    }

    // 3. Extraction de l'expéditeur
    const senderPatterns = [
      /sender[\s:]*([A-Z][a-zA-ZÀ-ÿ\s]{3,50})/gi,
      /from[\s:]*([A-Z][a-zA-ZÀ-ÿ\s]{3,50})/gi,
      /shipper[\s:]*([A-Z][a-zA-ZÀ-ÿ\s]{3,50})/gi,
    ];

    for (const pattern of senderPatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        result.senderName = match[1].trim();
        break;
      }
    }

    // 4. Extraction de l'adresse de livraison using comprehensive extractor (use HTML)
    result.pickupAddress = this.addressExtractor.extractAddress(htmlBody);

    // 5. Extraction de la date de livraison estimée using smart parser
    result.pickupDeadline = this.dateParser.parseDate(bodyOriginal, email.receivedAt);

    // 6. Détection du type de service DHL
    if (body.includes('dhl express')) {
      result.productName = 'DHL Express';
    } else if (body.includes('dhl ecommerce')) {
      result.productName = 'DHL eCommerce';
    } else if (body.includes('dhl parcel')) {
      result.productName = 'DHL Parcel';
    } else {
      result.productName = 'DHL';
    }

    // 7. Extraction du numéro de commande
    const orderPatterns = [
      /order[\s#:]*([A-Z0-9\-]{5,20})/gi,
      /reference[\s#:]*([A-Z0-9\-]{5,20})/gi,
      /commande[\s#:]*([A-Z0-9\-]{5,20})/gi,
    ];

    for (const pattern of orderPatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        result.orderNumber = match[1].trim();
        break;
      }
    }

    return result;
  }

  /**
   * Valide qu'un numéro ressemble à un tracking DHL
   */
  private isDHLTrackingNumber(num: string): boolean {
    // DHL Express: 10-11 chiffres
    if (/^\d{10,11}$/.test(num)) return true;
    
    // DHL eCommerce: GM/LX/RX/JD + 12-16 chiffres
    if (/^(GM|LX|RX|JD|JJ|JA)\d{12,16}$/.test(num)) return true;
    
    return false;
  }

  /**
   * Parse une date (format DD/MM/YYYY ou MM/DD/YYYY)
   */
  private parseDate(dateStr: string): Date {
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const fullYear = year < 100 ? 2000 + year : year;
      return new Date(fullYear, month, day);
    }
    throw new Error('Invalid date format');
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
