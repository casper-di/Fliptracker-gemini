import { Injectable } from '@nestjs/common';
import { ParsedTrackingInfo } from '../email-parsing.service';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';

/**
 * Parser spécialisé pour Colissimo / La Poste
 * Supporte: Colissimo, Chronopost (filiale), Lettre Suivie
 */
@Injectable()
export class ColissimoParserService {
  constructor(private shipmentTypeDetector: ShipmentTypeDetectorService) {}

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

    // 1. Extraction du numéro de suivi Colissimo
    // Formats: 
    // - 6A12345678901 (13 caractères, commence par 6A/6V/7A/8A/8V)
    // - RR123456789FR (international, 13 caractères)
    // - LA123456789FR (Lettre Suivie)
    const trackingPatterns = [
      /(?:suivi|tracking|colis|n[°o]?[\s:]*)\s*([6-8][AV]\d{11})/gi,
      /([6-8][AV]\d{11})/g, // Format standard Colissimo
      /([RL][A-Z]\d{9}[A-Z]{2})/g, // Format international/Lettre Suivie
    ];

    for (const pattern of trackingPatterns) {
      const match = bodyOriginal.match(pattern);
      if (match) {
        // Prendre le dernier match qui ressemble le plus à un tracking number
        const potential = match[match.length - 1];
        if (potential.match(/^[6-8][AV]\d{11}$/) || potential.match(/^[RL][A-Z]\d{9}[A-Z]{2}$/)) {
          result.trackingNumber = potential;
          break;
        }
      }
    }

    // 2. Extraction du marketplace/expéditeur
    // Pattern: "Votre Colissimo confié par {Marketplace}"
    const marketplaceMatch = bodyOriginal.match(/Votre\s+Colissimo\s+confié\s+par\s+([A-Z][a-zA-Z0-9\s]{2,30})/i);
    if (marketplaceMatch && marketplaceMatch[1]) {
      result.marketplace = marketplaceMatch[1].trim();
    }

    // 3. Extraction du code de retrait (pour points de retrait Colissimo)
    const withdrawalPatterns = [
      /code[\s]*(?:de[\s]*)?retrait[\s:]*([A-Z0-9]{4,8})/gi,
      /votre[\s]*code[\s:]*([A-Z0-9]{4,8})/gi,
      /code[\s]*point[\s]*retrait[\s:]*([A-Z0-9]{4,8})/gi,
    ];

    for (const pattern of withdrawalPatterns) {
      const match = bodyOriginal.match(pattern);
      if (match && match[1]) {
        result.withdrawalCode = match[1];
        break;
      }
    }

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

    // 5. Extraction de l'adresse du point retrait - version améliorée
    let pickupAddress: string | null = null;
    
    // Pattern 1: HTML structure with ADRESSE : and BR tags
    // Example: ADRESSE :</strong></p><p>STE FOY LES LYON BP</p><p>STE FOY LES LYON</p><p>15 BOULEVARD BARON DU MARAIS</p><p>69110 STE FOY LES LYON</p>
    const htmlAddressMatch = bodyOriginal.match(/ADRESSE\s*:?<\/strong>.*?<\/p>([\s\S]{20,400}?\d{5}[\s<]*[A-Z][a-zÀ-ÿ\s]+)/i);
    if (htmlAddressMatch) {
      // Extract all <p> or text between BR tags
      const addressSection = htmlAddressMatch[0];
      const lines: string[] = [];
      
      // Extract paragraph content
      const paragraphs = addressSection.match(/<p[^>]*>([^<]+)<\/p>/gi);
      if (paragraphs) {
        paragraphs.forEach(p => {
          const content = p.replace(/<\/?p[^>]*>/gi, '').trim();
          if (content && content !== 'ADRESSE' && !content.match(/^(\s*:|<)/) && content.length < 100) {
            lines.push(content);
          }
        });
      }
      
      if (lines.length > 0) {
        pickupAddress = lines.join('\n');
      }
    }
    
    // Pattern 2: Try comprehensive patterns (fallback)
    if (!pickupAddress) {
      const pickupAddressPatterns = [
        /point[\s]*retrait[\s:]*(.{10,200}?(?:\d{5}[\s]*[A-Z][a-zÀ-ÿ]+))/gi,
        /adresse[\s]*(?:du[\s]*)?point[\s:]*(.{10,200}?(?:\d{5}[\s]*[A-Z][a-zÀ-ÿ]+))/gi,
        /retirez[\s]*votre[\s]*colis[\s]*[àa][\s:]*(.{10,200}?(?:\d{5}[\s]*[A-Z][a-zÀ-ÿ]+))/gi,
      ];

      for (const pattern of pickupAddressPatterns) {
        const match = bodyOriginal.match(pattern);
        if (match && match[1]) {
          pickupAddress = match[1].trim().replace(/\s+/g, ' ');
          break;
        }
      }
    }
    
    result.pickupAddress = pickupAddress;

    // 6. Extraction de la date limite de retrait
    // Format français long: "jusqu'au samedi 20 décembre 2025"
    const frenchLongDateMatch = bodyOriginal.match(/jusqu[\']?au?\s+(?:\w+\s+)?(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i);
    if (frenchLongDateMatch) {
      const day = parseInt(frenchLongDateMatch[1], 10);
      const monthName = frenchLongDateMatch[2].toLowerCase();
      const year = parseInt(frenchLongDateMatch[3], 10);
      
      const monthMap: { [key: string]: number } = {
        'janvier': 0, 'février': 1, 'fevrier': 1, 'mars': 2, 'avril': 3,
        'mai': 4, 'juin': 5, 'juillet': 6, 'août': 7, 'aout': 7,
        'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11, 'decembre': 11
      };
      
      const month = monthMap[monthName];
      if (month !== undefined) {
        result.pickupDeadline = new Date(year, month, day);
      }
    }
    
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
