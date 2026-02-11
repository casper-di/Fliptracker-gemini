import { Injectable } from '@nestjs/common';

export type CarrierType = 
  | 'vinted_go' 
  | 'mondial_relay'
  | 'relais_colis' 
  | 'chronopost' 
  | 'colissimo' 
  | 'laposte' 
  | 'dhl' 
  | 'ups' 
  | 'fedex'
  | 'dpd'
  | 'colis_prive'
  | 'gls'
  | 'amazon_logistics'
  | 'other';

@Injectable()
export class CarrierDetectorService {
  /**
   * Detect carrier from sender email, subject, and body
   * Uses comprehensive pattern matching for French and international carriers
   */
  detectCarrier(email: { from: string; subject: string; body?: string }): CarrierType {
    const from = email.from.toLowerCase();
    const subject = email.subject.toLowerCase();
    const body = email.body?.toLowerCase() || '';

    console.log(`[CarrierDetector] Analyzing email from="${from.substring(0, 60)}" subject="${subject.substring(0, 80)}"`);

    // ---- STEP 1: Check sender (from) first — most reliable signal ----
    // Carrier-specific sender domains take absolute priority
    if (this.matchesPatterns(from, ['chronopost.fr', 'chronopost.com', 'pickup.fr'])) {
      return 'chronopost';
    }
    if (this.matchesPatterns(from, ['mondialrelay.fr', 'mondialrelay.com'])) {
      return 'mondial_relay';
    }
    if (this.matchesPatterns(from, ['colissimo.fr', 'laposte.fr', 'laposte.net'])) {
      return 'colissimo';
    }
    if (this.matchesPatterns(from, ['dhl.com', 'dhl.fr', 'dhl.de'])) {
      return 'dhl';
    }
    if (this.matchesPatterns(from, ['ups.com', 'ups.fr'])) {
      return 'ups';
    }
    if (this.matchesPatterns(from, ['fedex.com', 'fedex.fr'])) {
      return 'fedex';
    }
    if (this.matchesPatterns(from, ['dpd.fr', 'dpd.com'])) {
      return 'dpd';
    }
    if (this.matchesPatterns(from, ['colisprive.fr', 'colisprive.com'])) {
      return 'colis_prive';
    }
    if (this.matchesPatterns(from, ['gls-france.com', 'gls.fr'])) {
      return 'gls';
    }
    if (this.matchesPatterns(from, ['relaiscolis.com'])) {
      return 'relais_colis';
    }
    if (this.matchesPatterns(from, ['amazon.fr', 'amazon.com'])) {
      return 'amazon_logistics';
    }

    // ---- STEP 2: For VintedGo-specific sender ----
    if (this.matchesPatterns(from, ['vintedgo.com', 'vinted.com', 'vinted.fr'])) {
      // Check if body indicates a SPECIFIC carrier (Vinted sends on behalf of carriers)
      // e.g. "Chronopost Pickup" / "Mondial Relay" in body
      if (this.bodyMentionsCarrier(body, ['chronopost', 'chrono pickup', 'chronopost.fr'])) {
        return 'chronopost';
      }
      if (this.bodyMentionsCarrier(body, ['mondial relay', 'mondialrelay'])) {
        return 'mondial_relay';
      }
      if (this.bodyMentionsCarrier(body, ['colissimo', 'la poste'])) {
        return 'colissimo';
      }
      // Otherwise it's a genuine Vinted Go shipment
      return 'vinted_go';
    }

    // ---- STEP 3: Body-based detection for forwarded or unknown-sender emails ----
    // Check SPECIFIC carriers BEFORE vinted (forwarded emails have user's from, not carrier's)
    if (this.bodyMentionsCarrier(body, ['chronopost.fr', 'chronopost.com', 'chrono pickup', 'chronopost relais', 'chrono relais'])) {
      return 'chronopost';
    }
    if (this.bodyMentionsCarrier(body, ['mondialrelay.fr', 'mondial relay', 'mondialrelay'])) {
      return 'mondial_relay';
    }
    if (this.bodyMentionsCarrier(body, ['colissimo.fr', 'colissimo', 'laposte.fr'])) {
      return 'colissimo';
    }
    if (this.bodyMentionsCarrier(body, ['dhl.com', 'dhl express', 'dhl parcel'])) {
      return 'dhl';
    }
    if (this.bodyMentionsCarrier(body, ['ups.com', 'united parcel'])) {
      return 'ups';
    }
    if (this.bodyMentionsCarrier(body, ['fedex.com', 'fedex express'])) {
      return 'fedex';
    }

    // Vinted Go — only if no specific carrier was found above
    if (this.matchesPatterns(`${from} ${subject} ${body}`, ['vintedgo.com', 'vintedgo', 'vinted go'])) {
      return 'vinted_go';
    }
    // Generic "vinted" (marketplace, not a specific carrier) — route to vinted_go as default
    if (this.matchesPatterns(`${from} ${subject} ${body}`, ['vinted.com', 'vinted.fr'])) {
      return 'vinted_go';
    }

    // Remaining carriers via combined text
    const combined = `${from} ${subject} ${body}`;
    if (this.matchesPatterns(combined, ['relaiscolis.com'])) return 'relais_colis';
    if (this.matchesPatterns(combined, ['dpd.fr', 'dpd parcel'])) return 'dpd';
    if (this.matchesPatterns(combined, ['colisprive.fr', 'colis privé', 'colis prive'])) return 'colis_prive';
    if (this.matchesPatterns(combined, ['gls-france.com', 'gls parcel'])) return 'gls';
    if (this.matchesPatterns(combined, ['amazon logistics', 'livraison amazon'])) return 'amazon_logistics';

    return 'other';
  }

  /**
   * Helper: Check if combined string matches any pattern
   */
  private matchesPatterns(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }

  /**
   * Check if body mentions a specific carrier.
   * Uses word-boundary-aware matching to avoid false positives.
   */
  private bodyMentionsCarrier(body: string, patterns: string[]): boolean {
    return patterns.some(pattern => body.includes(pattern));
  }

  /**
   * Get carrier display name in French
   */
  getCarrierDisplayName(carrier: CarrierType): string {
    const names: Record<CarrierType, string> = {
      vinted_go: 'Vinted Go',
      mondial_relay: 'Mondial Relay',
      relais_colis: 'Relais Colis',
      chronopost: 'Chronopost',
      colissimo: 'Colissimo',
      laposte: 'La Poste',
      dhl: 'DHL',
      ups: 'UPS',
      fedex: 'FedEx',
      dpd: 'DPD',
      colis_prive: 'Colis Privé',
      gls: 'GLS',
      amazon_logistics: 'Amazon Logistics',
      other: 'Autre transporteur',
    };
    return names[carrier] || carrier;
  }
}
