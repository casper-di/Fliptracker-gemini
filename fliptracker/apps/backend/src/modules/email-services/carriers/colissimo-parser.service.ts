import { Injectable } from '@nestjs/common';
import { ParsedTrackingInfo } from '../email-parsing.service';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';
import { AddressExtractorService } from '../utils/address-extractor.service';
import { TrackingValidatorService } from '../utils/tracking-validator.service';
import { DateParserService } from '../utils/date-parser.service';
import { WithdrawalCodeExtractorService } from '../utils/withdrawal-code-extractor.service';
import { MarketplaceDetectorService } from '../utils/marketplace-detector.service';
import { QRCodeExtractorService } from '../utils/qr-code-extractor.service';

/**
 * Parser spécialisé pour Colissimo / La Poste
 * Supporte: Colissimo, Chronopost (filiale), Lettre Suivie
 */
@Injectable()
export class ColissimoParserService {
  constructor(
    private shipmentTypeDetector: ShipmentTypeDetectorService,
    private addressExtractor: AddressExtractorService,
    private trackingValidator: TrackingValidatorService,
    private dateParser: DateParserService,
    private withdrawalCodeExtractor: WithdrawalCodeExtractorService,
    private marketplaceDetector: MarketplaceDetectorService,
    private qrCodeExtractor: QRCodeExtractorService,
  ) {}

  /**
   * Parse un email Colissimo pour extraire les informations de livraison
   */
  parse(email: { subject: string; from: string; body: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      carrier: 'colissimo',
      marketplace: null,
      type: this.shipmentTypeDetector.detectType(email),
    };

    const body = email.body.toLowerCase();
    const bodyOriginal = email.body;

    // 1. Extraction du numéro de suivi avec validation
    const trackingPatterns = [
      /(?:tracking|suivi|colis)[\s:#]*([A-Z]{2}\d{9}[A-Z]{2})/gi,
      /(?:n[°u]m[eé]ro|num[eé]ro)[\s:]*([A-Z]{2}\d{9}[A-Z]{2})/gi,
      /([A-Z]{2}\d{9}[A-Z]{2})/g,
      /\b([0-9]{13,18})\b/g, // Tracking alternatif numérique
    ];

    for (const pattern of trackingPatterns) {
      const matches = bodyOriginal.match(pattern);
      if (matches) {
        const potential = matches[matches.length - 1];
        const validated = this.trackingValidator.validateTracking(potential, 'colissimo');
        if (validated) {
          result.trackingNumber = validated;
          break;
        }
      }
    }

    // 2. Extraction du marketplace/expéditeur
    result.marketplace = this.marketplaceDetector.detectMarketplace(email);

    // 3. Extraction du code de retrait (pour points de retrait Colissimo)
    result.withdrawalCode = this.withdrawalCodeExtractor.extractCode(bodyOriginal, bodyOriginal);

    // 4. Extraction du nom du destinataire
    const recipientPatterns = [
      /destinataire[\s:]*([A-Z][a-zÀ-ÿ]+\s+[A-Z][a-zÀ-ÿ]+)/gi,
      /livraison[\s]*pour[\s:]*([A-Z][a-zÀ-ÿ]+\s+[A-Z][a-zÀ-ÿ]+)/gi,
      /(?:bonjour|madame|monsieur)[\s]*([A-Z][a-zÀ-ÿ]+\s+[A-Z][a-zÀ-ÿ]+)/gi,
    ];

    for (const pattern of recipientPatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        result.recipientName = match[1].trim();
        break;
      }
    }

    // 5. Extraction de l'adresse du point retrait
    result.pickupAddress = this.addressExtractor.extractAddress(bodyOriginal);

    // 6. Extraction de la date limite de retrait
    result.pickupDeadline = this.dateParser.parseDate(bodyOriginal, email.receivedAt);
    
    // Fallback: Format numérique classique
    if (!result.pickupDeadline) {
      const deadlinePatterns = [
        /avant[\s]*le[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        /jusque?[\s]*au[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        /disponible[\s]*jusqu[\']?au[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
        /limit[eé][\s]*(?:de[\s]*)?retrait[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      ];

      for (const pattern of deadlinePatterns) {
        const match = bodyOriginal.match(pattern);
        if (match && match[1]) {
          try {
            result.pickupDeadline = this.parseDate(match[1]);
          } catch (e) {
            // Ignore invalid dates
          }
          break;
        }
      }
    }

    // 7. Extraction du QR code / barcode
    // Pattern: URL du barcode Colissimo
    const qrCodeMatch = bodyOriginal.match(/colissimo\.fr\/entreprise\/nad-bo\/cab\.htm\?parcel=([A-Z0-9]+)/i);
    if (qrCodeMatch && qrCodeMatch[0]) {
      result.qrCode = 'https://www.' + qrCodeMatch[0];
    }

    // 8. Extraction du nom de l'expéditeur
    const senderPatterns = [
      /exp[éeè]diteur[\s:]*([A-Z][a-zA-ZÀ-ÿ\s]{2,40})/gi,
      /envoy[éeè][\s]*par[\s:]*([A-Z][a-zA-ZÀ-ÿ\s]{2,40})/gi,
    ];

    for (const pattern of senderPatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        result.senderName = match[1].trim();
        break;
      }
    }

    // 9. Détection du type de service
    if (body.includes('chronopost')) {
      result.carrier = 'chronopost';
    } else if (body.includes('lettre suivie')) {
      result.productName = 'Lettre Suivie';
    } else if (body.includes('colissimo international')) {
      result.productName = 'Colissimo International';
    } else if (body.includes('point retrait') || body.includes('point de retrait')) {
      result.productName = 'Colissimo Point Retrait';
    } else {
      // Extract from marketplace if available
      if (result.marketplace) {
        result.productName = `Colissimo (${result.marketplace})`;
      } else {
        result.productName = 'Colissimo';
      }
    }

    return result;
  }

  /**
   * Parse une date française (format DD/MM/YYYY ou DD-MM-YYYY)
   */
  private parseDate(dateStr: string): Date {
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const year = parseInt(parts[2], 10);
      const fullYear = year < 100 ? 2000 + year : year;
      return new Date(fullYear, month, day);
    }
    throw new Error('Invalid date format');
  }
}
