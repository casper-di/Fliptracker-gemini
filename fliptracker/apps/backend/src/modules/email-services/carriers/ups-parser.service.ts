import { Injectable } from '@nestjs/common';
import { ParsedTrackingInfo } from '../email-parsing.service';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';
import { TrackingValidatorService } from '../utils/tracking-validator.service';
import { DateParserService } from '../utils/date-parser.service';
import { AddressExtractorService } from '../utils/address-extractor.service';

/**
 * Parser spécialisé pour UPS (United Parcel Service)
 */
@Injectable()
export class UPSParserService {
  constructor(
    private shipmentTypeDetector: ShipmentTypeDetectorService,
    private trackingValidator: TrackingValidatorService,
    private dateParser: DateParserService,
    private addressExtractor: AddressExtractorService,
  ) {}

  /**
   * Parse un email UPS pour extraire les informations de livraison
   */
  parse(email: { subject: string; from: string; body: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      carrier: 'ups',
      marketplace: null,
      type: this.shipmentTypeDetector.detectType(email),
    };

    const bodyOriginal = this.stripHTML(email.body);
    const htmlBody = email.body; // Keep HTML for address/sender extraction

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
          
          // Validate UPS format using utility (with checksum)
          const validated = this.trackingValidator.validateTracking(cleaned, 'ups');
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
      // Pattern 1: Greeting in HTML (common in UPS emails)
      /(?:Bonjour|Dear|Hello|Hi)\s+([A-ZÀ-ÿ][a-zA-ZÀ-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zA-ZÀ-ÿ]+){1,3})/i,
      // Pattern 2: "Ship to:" or "Deliver to:" (English UPS)
      /(?:ship\s*to|deliver\s*to|destinataire)[\s:]+([A-ZÀ-ÿ][a-zA-ZÀ-ÿ]+\s+[A-ZÀ-ÿ][a-zA-ZÀ-ÿ]+)/i,
    ];

    for (const pattern of recipientPatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Validate: at least 4 chars, not a noise word
        if (name.length >= 4 && name.length < 50 && !/votre|colis|package|tracking|shipment/i.test(name)) {
          result.recipientName = name;
          break;
        }
      }
    }

    // 3. Extraction de l'expéditeur (use original HTML for HTML-aware pattern)
    const senderPatterns = [
      /<span\s+id\s*=\s*["']shipperAndArrival["'][^>]*>[\s\S]*?<strong>([^<]+)<\/strong>/i,
      /(?:from|exp[éeè]diteur|shipper)[\s:]+([A-ZÀ-ÿ][a-zA-ZÀ-ÿ\s]{3,50}?)(?:\s*[<,\n])/i,
      /sent\s*by[\s:]+([A-ZÀ-ÿ][a-zA-ZÀ-ÿ\s]{3,50}?)(?:\s*[<,\n])/i,
    ];

    for (const pattern of senderPatterns) {
      // First pattern is HTML-aware, try on HTML; others on stripped
      const matchSource = pattern.source.includes('<') ? email.body : bodyOriginal;
      const match = matchSource.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length >= 3 && name.length < 50) {
          result.senderName = name;
          break;
        }
      }
    }

    // 4. Extraction de l'adresse using comprehensive extractor (use HTML)
    result.pickupAddress = this.addressExtractor.extractAddress(htmlBody);

    // 5. Extraction de la date using smart parser
    result.pickupDeadline = this.dateParser.parseDate(bodyOriginal, email.receivedAt);

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
      /reference[\s#:]*([A-Z0-9\-]{5,25})/i,
      /order[\s#:]*([A-Z0-9\-]{5,25})/i,
      /invoice[\s#:]*([A-Z0-9\-]{5,25})/i,
    ];

    for (const pattern of referencePatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        result.orderNumber = match[1].trim();
        break;
      }
    }

    // 8. Extraction du poids (optionnel)
    const weightPattern = /weight[\s:]*(\d+(?:\.\d+)?)\s*(lb|kg|lbs)/i;
    const weightMatch = bodyOriginal.match(weightPattern);
    if (weightMatch && weightMatch[0]) {
      result.productDescription = weightMatch[0].trim();
    }

    return result;
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
