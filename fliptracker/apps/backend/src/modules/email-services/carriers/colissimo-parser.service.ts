import { Injectable } from '@nestjs/common';
import { ParsedTrackingInfo } from '../email-parsing.service';

/**
 * Parser spécialisé pour Colissimo / La Poste
 * Supporte: Colissimo, Chronopost (filiale), Lettre Suivie
 */
@Injectable()
export class ColissimoParserService {
  /**
   * Parse un email Colissimo pour extraire les informations de livraison
   */
  parse(email: { subject: string; from: string; body: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      carrier: 'colissimo',
      marketplace: null,
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

    // 2. Extraction du code de retrait (pour points de retrait Colissimo)
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

    // 3. Extraction du nom du destinataire
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

    // 4. Extraction de l'adresse du point retrait - version améliorée
    let pickupAddress: string | null = null;
    
    // Try comprehensive patterns first (up to 200 chars to capture full address)
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
    
    result.pickupAddress = pickupAddress;

    // 5. Extraction de la date limite de retrait
    const deadlinePatterns = [
      /avant[\s]*le[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      /jusque?[\s]*au[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      /disponible[\s]*jusqu[\'']?au[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
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

    // 6. Extraction du nom de l'expéditeur
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

    // 7. Détection du type de service
    if (body.includes('chronopost')) {
      result.carrier = 'chronopost';
    } else if (body.includes('lettre suivie')) {
      result.productName = 'Lettre Suivie';
    } else if (body.includes('colissimo international')) {
      result.productName = 'Colissimo International';
    } else if (body.includes('point retrait')) {
      result.productName = 'Colissimo Point Retrait';
    } else {
      result.productName = 'Colissimo';
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
