import { Injectable } from '@nestjs/common';

@Injectable()
export class TrackingValidatorService {
  /**
   * Validate and clean tracking number for specific carrier
   */
  validateTracking(tracking: string | null, carrier: string): string | null {
    if (!tracking) return null;

    const cleaned = tracking.trim().toUpperCase().replace(/\s+/g, '');

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
        return cleaned.length >= 8 ? cleaned : null;
    }
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
   * Colissimo: 6A/6V/7A/8A/8V + 11 digits, or RR/LA + 9 digits + 2 letters
   */
  private validateColissimo(tracking: string): string | null {
    if (/^[6-8][AV]\d{11}$/.test(tracking)) return tracking;
    if (/^[RL][A-Z]\d{9}[A-Z]{2}$/.test(tracking)) return tracking;
    return null;
  }

  /**
   * Chronopost: 13 digits
   */
  private validateChronopost(tracking: string): string | null {
    if (/^\d{13}$/.test(tracking)) return tracking;
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
