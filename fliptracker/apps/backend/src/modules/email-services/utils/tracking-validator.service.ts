import { Injectable } from '@nestjs/common';

@Injectable()
export class TrackingValidatorService {
  /**
   * Validate and clean tracking number for specific carrier
   */
  validateTracking(tracking: string | null, carrier: string): string | null {
    if (!tracking) return null;

    const cleaned = tracking.trim().toUpperCase().replace(/\s+/g, '');
    
    // Global validation: reject obvious non-tracking strings
    if (!this.isLikelyTrackingNumber(cleaned)) return null;

    switch (carrier) {
      case 'ups':
        return this.validateUPS(cleaned);
      case 'fedex':
        return this.validateFedEx(cleaned);
      case 'dhl':
        return this.validateDHL(cleaned);
      case 'colissimo':
      case 'laposte':
        return this.validateColissimo(cleaned);
      case 'chronopost':
        return this.validateChronopost(cleaned);
      case 'vinted_go':
        return this.validateVintedGo(cleaned);
      case 'mondial_relay':
        return this.validateMondialRelay(cleaned);
      default:
        return this.validateGeneric(cleaned);
    }
  }

  /**
   * Basic sanity check: is this string likely a tracking number?
   */
  private isLikelyTrackingNumber(s: string): boolean {
    // Must be 6-40 chars
    if (s.length < 6 || s.length > 40) return false;
    // Must contain at least some digits
    if (!/\d/.test(s)) return false;
    // Reject if it's a common word/phrase
    const lower = s.toLowerCase();
    const rejectWords = ['tracking', 'information', 'suivi', 'livraison', 'undefined', 'null', 'numero', 'numéro', 'details'];
    if (rejectWords.some(w => lower.includes(w))) return false;
    // Reject all-same-digit numbers (like 333333333333336)
    if (/^(\d)\1{7,}$/.test(s)) return false;
    // Reject sequences (like 12345678901234)
    if (/^0?1234567890/.test(s)) return false;
    return true;
  }

  /**
   * Generic validation for unknown carriers
   */
  private validateGeneric(tracking: string): string | null {
    // Must be at least 8 alphanumeric chars
    if (!/^[A-Z0-9]{8,30}$/.test(tracking)) return null;
    // Reject all-same-digit
    if (/^(\d)\1+$/.test(tracking)) return null;
    return tracking;
  }

  /**
   * UPS: 1Z + 6 alphanumeric + 10 digits (18 chars total)
   * Includes checksum validation
   */
  private validateUPS(tracking: string): string | null {
    if (!/^1Z[A-Z0-9]{16}$/.test(tracking)) return null;

    // UPS checksum validation
    const checkDigit = tracking[17];
    const calculated = this.calculateUPSCheckDigit(tracking.slice(0, 17));
    
    return checkDigit === calculated ? tracking : null;
  }

  private calculateUPSCheckDigit(tracking: string): string {
    const charMap: Record<string, number> = {
      A: 2, B: 3, C: 4, D: 5, E: 6, F: 7, G: 8, H: 9, I: 0, J: 1,
      K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9, S: 0, T: 1,
      U: 2, V: 3, W: 4, X: 5, Y: 6, Z: 7,
    };

    let sum = 0;
    for (let i = 2; i < 17; i++) {
      const char = tracking[i];
      const value = /\d/.test(char) ? parseInt(char, 10) : charMap[char] || 0;
      sum += (i % 2 === 0) ? value : value * 2;
    }

    const remainder = sum % 10;
    return remainder === 0 ? '0' : (10 - remainder).toString();
  }

  /**
   * FedEx: 12 digits (starts with 7/9), 15 digits, or 22 digits (SmartPost)
   */
  private validateFedEx(tracking: string): string | null {
    if (/^\d{12}$/.test(tracking) && /^[79]/.test(tracking)) return tracking;
    if (/^\d{15}$/.test(tracking)) return tracking;
    if (/^92\d{20}$/.test(tracking)) return tracking;
    return null;
  }

  /**
   * DHL: 10-11 digits, or GM/LX/RX/JD prefix + 12-16 digits
   */
  private validateDHL(tracking: string): string | null {
    if (/^\d{10,11}$/.test(tracking)) return tracking;
    if (/^(GM|LX|RX|JD|JJ|JA)\d{12,16}$/.test(tracking)) return tracking;
    return null;
  }

  /**
   * Colissimo/La Poste tracking formats:
   * - 6A/6V/7A/8A/8V + 11 digits (Colissimo standard)
   * - RR/LA + 9 digits + 2 letters (registered mail)
   * - A/J + 10 digits (La Poste bureau format, e.g. A0429190862, J0213781630)
   * - 11-15 digit pure numeric
   */
  private validateColissimo(tracking: string): string | null {
    if (/^[6-8][AV]\d{11}$/.test(tracking)) return tracking;
    if (/^[RL][A-Z]\d{9}[A-Z]{2}$/.test(tracking)) return tracking;
    // La Poste single-letter prefix + 10 digits
    if (/^[A-Z]\d{10}$/.test(tracking)) return tracking;
    // Two-letter prefix + 11-13 digits (e.g., PP42753268305, CB1234567890123)
    if (/^[A-Z]{2}\d{11,13}$/.test(tracking)) return tracking;
    // Pure numeric: 11-15 digits
    if (/^\d{11,15}$/.test(tracking)) return tracking;
    return null;
  }

  /**
   * Chronopost: 13 digits, or 2 letters + 9-11 digits + 2 letters (e.g., XW250342935TS)
   */
  private validateChronopost(tracking: string): string | null {
    if (/^\d{13}$/.test(tracking)) return tracking;
    if (/^[A-Z]{2}\d{9,11}[A-Z]{2}$/.test(tracking)) return tracking;
    // Also accept 10-digit format sometimes used
    if (/^\d{10}$/.test(tracking)) return tracking;
    return null;
  }

  /**
   * Vinted Go: 16-20 digits
   */
  private validateVintedGo(tracking: string): string | null {
    if (/^\d{16,20}$/.test(tracking)) return tracking;
    return null;
  }

  /**
   * Mondial Relay: 1-3 letters + 8-12 digits, or just 8-12 digits
   */
  private validateMondialRelay(tracking: string): string | null {
    if (/^[A-Z]{1,3}\d{8,12}$/.test(tracking)) return tracking;
    if (/^\d{8,12}$/.test(tracking)) return tracking;
    return null;
  }
}
