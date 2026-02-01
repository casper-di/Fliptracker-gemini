import { Injectable } from '@nestjs/common';
import { ParsedTrackingInfo } from '../email-parsing.service';

/**
 * Parser spécialisé pour DHL Express et DHL Parcel
 */
@Injectable()
export class DHLParserService {
  /**
   * Parse un email DHL pour extraire les informations de livraison
   */
  parse(email: { subject: string; from: string; body: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      carrier: 'dhl',
      marketplace: null,
    };

    const body = email.body.toLowerCase();
    const bodyOriginal = email.body;

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
          // Extraire juste le numéro
          const cleaned = match.replace(/(?:tracking|waybill|awb|shipment)[\s#:]*/gi, '').trim();
          
          // Valider le format DHL
          if (this.isDHLTrackingNumber(cleaned)) {
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

    // 4. Extraction de l'adresse de livraison
    const addressPatterns = [
      /delivery[\s]*address[\s:]*(.{10,150}(?:\d{5}|\d{4}))/gi,
      /adresse[\s]*de[\s]*livraison[\s:]*(.{10,150}(?:\d{5}|\d{4}))/gi,
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
      /estimated[\s]*delivery[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      /delivery[\s]*by[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      /livraison[\s]*pr[éeè]vue[\s]*le[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
    ];

    for (const pattern of deliveryDatePatterns) {
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
}
