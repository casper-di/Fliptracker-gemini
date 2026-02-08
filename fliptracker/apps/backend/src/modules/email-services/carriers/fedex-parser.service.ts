import { Injectable } from '@nestjs/common';
import { ParsedTrackingInfo } from '../email-parsing.service';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';
import { TrackingValidatorService } from '../utils/tracking-validator.service';
import { DateParserService } from '../utils/date-parser.service';
import { AddressExtractorService } from '../utils/address-extractor.service';

/**
 * Parser spécialisé pour FedEx
 */
    private shipmentTypeDetector: ShipmentTypeDetectorService,
    private trackingValidator: TrackingValidatorService,
    private dateParser: DateParserService,
    private addressExtractor: AddressExtractorService,
  
@Injectable()
export class FedExParserService {
  constructor(private shipmentTypeDetector: ShipmentTypeDetectorService) {}

  /**
   * Parse un email FedEx pour extraire les informations de livraison
   */
  parse(email: { subject: string; from: string; body: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      carrier: 'fedex',
      marketplace: null,
      type: this.shipmentTypeDetector.detectType(email),
    };

    const bodyOriginal = email.body;

    // 1. Extraction du numéro de suivi FedEx
    // Formats FedEx:
    // - Express: 12 chiffres (commençant souvent par 7 ou 9)
    // - Ground: 15 chiffres
    // - SmartPost: 22 chiffres (commence souvent par 92)
    const trackingPatterns = [
      /tracking[\s#:]*(\d{12,22})/gi,
      /\b(\d{12})\b/g, // 12 chiffres (Express)
      /\b(\d{15})\b/g, // 15 chiffres (Ground)
      /\b(92\d{20})\b/g, // 22 chiffres SmartPost
    ];

    for (const pattern of trackingPatterns) {
      const matcheate FedEx format using utility
          const validated = this.trackingValidator.validateTracking(cleaned, 'fedex');
          if (validated) {
            result.trackingNumber = validated;
            break;
          }
        }
        if (result.trackingNumber) break;
      }
    }

    // 2. Extraction du nom du destinataire
    const recipientPatterns = [
      /(?:dear|hello|hi)[\s]*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/gi,
      /deliver[\s]*to[\s:]*([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)/gi,
      /recipient[\s:]*([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)/gi,
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
      /from[\s:]*([A-Z][a-zA-ZÀ-ÿ\s]{3,50})/gi,
      /shipper[\s:]*([A-Z][a-zA-ZÀ-ÿ\s]{3,50})/gi,
      /sender[\s:]*([A-Z][a-zA-ZÀ-ÿ\s]{3,50})/gi,
    ];

    for (const pattern of senderPatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        result.senderName = match[1].trim();
        break;
      }
    }

    // 4. Extraction de l'adresse using comprehensive extractor
    result.pickupAddress = this.addressExtractor.extractAddress(bodyOriginal);

    // 5. Extraction de la date using smart parser
    result.pickupDeadline = this.dateParser.parseDate(bodyOriginal, email.receivedAt);
    // 5. Extraction de la date de livraison estimée
    const deliveryDatePatterns = [
      /scheduled[\s]*delivery[\s:]*(\w+,?\s+\w+\s+\d{1,2},?\s+\d{4})/gi,
      /delivery[\s]*(?:by|on)[\s:]*(\w+,?\s+\w+\s+\d{1,2},?\s+\d{4})/gi,
      /estimated[\s]*delivery[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
    ];

    for (const pattern of deliveryDatePatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        try {
          result.pickupDeadline = new Date(match[1]);
        } catch (e) {
          // Ignore invalid dates
        }
        break;
      }
    }

    // 6. Détection du type de service FedEx
    const body = email.body.toLowerCase();
    if (body.includes('fedex express') || body.includes('fedex overnight')) {
      result.productName = 'FedEx Express';
    } else if (body.includes('fedex priority') || body.includes('fedex 2day')) {
      result.productName = 'FedEx Priority Overnight';
    } else if (body.includes('fedex ground')) {
      result.productName = 'FedEx Ground';
    } else if (body.includes('fedex home')) {
      result.productName = 'FedEx Home Delivery';
    } else if (body.includes('fedex smartpost')) {
      result.productName = 'FedEx SmartPost';
    } else if (body.includes('fedex international')) {
      result.productName = 'FedEx International';
    } else {
      result.productName = 'FedEx';
    }

    // 7. Extraction du numéro de référence / commande
    const referencePatterns = [
      /reference[\s#:]*([A-Z0-9\-]{5,25})/gi,
      /order[\s#:]*([A-Z0-9\-]{5,25})/gi,
      /po[\s#:]*([A-Z0-9\-]{5,25})/gi,
    ];

    for (const pattern of referencePatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        result.orderNumber = match[1].trim();
        break;
      }
    }

    // 8. Extraction du poids et du nombre de colis
    const packageInfoPattern = /(\d+)\s*package(?:s)?(?:\s*,\s*(\d+(?:\.\d+)?)\s*(lb|kg|lbs))?/gi;
    const packageMatch = bodyOriginal.match(packageInfoPattern);
    if (packageMatch && packageMatch[0]) {
      result.productDescription = packageMatch[0].trim();
    }

    return result;
  }
}
