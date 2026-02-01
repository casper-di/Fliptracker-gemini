import { Injectable } from '@nestjs/common';
import { ParsedTrackingInfo } from '../email-parsing.service';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';

/**
 * Parser spécialisé pour UPS (United Parcel Service)
 */
@Injectable()
export class UPSParserService {
  constructor(private shipmentTypeDetector: ShipmentTypeDetectorService) {}

  /**
   * Parse un email UPS pour extraire les informations de livraison
   */
  parse(email: { subject: string; from: string; body: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      carrier: 'ups',
      marketplace: null,
      type: this.shipmentTypeDetector.detectType(email),
    };

    const bodyOriginal = email.body;

    // 1. Extraction du numéro de suivi UPS
    // Formats UPS:
    // - 1Z format: 1Z + 6 caractères alphanumériques + 10 chiffres (18 total)
    // - Tracking Key: 9 chiffres
    // - InfoNotice: Format variable
    const trackingPatterns = [
      /(1Z[A-Z0-9]{16})/gi, // Format 1Z standard
      /tracking[\s#:]*([A-Z0-9]{18})/gi,
      /\b([A-Z0-9]{18})\b/g, // 18 caractères alphanumériques
    ];

    for (const pattern of trackingPatterns) {
      const matches = bodyOriginal.match(pattern);
      if (matches) {
        for (const match of matches) {
          const cleaned = match.replace(/tracking[\s#:]*/gi, '').trim();
          
          // Valider le format UPS (doit commencer par 1Z)
          if (cleaned.match(/^1Z[A-Z0-9]{16}$/)) {
            result.trackingNumber = cleaned;
            break;
          }
        }
        if (result.trackingNumber) break;
      }
    }

    // 2. Extraction du nom du destinataire
    const recipientPatterns = [
      /(?:dear|hello|hi)[\s]*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/gi,
      /to[\s:]*([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)/gi,
      /ship[\s]*to[\s:]*([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)/gi,
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
      /sent[\s]*by[\s:]*([A-Z][a-zA-ZÀ-ÿ\s]{3,50})/gi,
    ];

    for (const pattern of senderPatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        result.senderName = match[1].trim();
        break;
      }
    }

    // 4. Extraction de l'adresse de livraison
    const addressPatterns = [
      /delivery[\s]*address[\s:]*(.{10,150}(?:\d{5}|\d{4}))/gi,
      /ship[\s]*to[\s]*address[\s:]*(.{10,150}(?:\d{5}|\d{4}))/gi,
    ];

    for (const pattern of addressPatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        result.pickupAddress = match[1].trim().replace(/\s+/g, ' ');
        break;
      }
    }

    // 5. Extraction de la date de livraison estimée
    const deliveryDatePatterns = [
      /scheduled[\s]*delivery[\s:]*(\w+,?\s+\w+\s+\d{1,2},?\s+\d{4})/gi, // Format: Monday, January 15, 2026
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

    // 6. Détection du type de service UPS
    const body = email.body.toLowerCase();
    if (body.includes('ups next day') || body.includes('ups express')) {
      result.productName = 'UPS Express';
    } else if (body.includes('ups 2nd day') || body.includes('ups 2 day')) {
      result.productName = 'UPS 2nd Day Air';
    } else if (body.includes('ups ground')) {
      result.productName = 'UPS Ground';
    } else if (body.includes('ups worldwide') || body.includes('ups international')) {
      result.productName = 'UPS Worldwide';
    } else {
      result.productName = 'UPS';
    }

    // 7. Extraction du numéro de référence / commande
    const referencePatterns = [
      /reference[\s#:]*([A-Z0-9\-]{5,25})/gi,
      /order[\s#:]*([A-Z0-9\-]{5,25})/gi,
      /invoice[\s#:]*([A-Z0-9\-]{5,25})/gi,
    ];

    for (const pattern of referencePatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        result.orderNumber = match[1].trim();
        break;
      }
    }

    // 8. Extraction du poids (optionnel)
    const weightPattern = /weight[\s:]*(\d+(?:\.\d+)?)\s*(lb|kg|lbs)/gi;
    const weightMatch = bodyOriginal.match(weightPattern);
    if (weightMatch && weightMatch[0]) {
      result.productDescription = weightMatch[0].trim();
    }

    return result;
  }
}
