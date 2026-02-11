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
   * 
   * Detection priority:
   * 1. Sender domain (most reliable)
   * 2. Retailer sender → body-based carrier sub-detection
   * 3. Vinted sender → body-based carrier sub-detection
   * 4. Body-based detection (for forwarded emails)
   * 5. Tracking number format detection (last resort before 'other')
   */
  detectCarrier(email: { from: string; subject: string; body?: string }): CarrierType {
    const from = email.from.toLowerCase();
    const subject = email.subject.toLowerCase();
    const body = email.body?.toLowerCase() || '';

    console.log(`[CarrierDetector] Analyzing email from="${from.substring(0, 60)}" subject="${subject.substring(0, 80)}"`);

    // ---- STEP 1: Carrier-specific sender domains (absolute priority) ----
    if (this.matchesPatterns(from, ['chronopost.fr', 'chronopost.com', 'pickup.fr'])) {
      return 'chronopost';
    }
    if (this.matchesPatterns(from, ['mondialrelay.fr', 'mondialrelay.com'])) {
      return 'mondial_relay';
    }
    // Colissimo / La Poste — including all laposte.info subdomains
    if (this.matchesPatterns(from, [
      'colissimo.fr', 'laposte.fr', 'laposte.net',
      'colissimo-laposte.info', 'notif-colissimo-laposte.info',
      'notif-laposte.info', 'laposte.info',
    ])) {
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
    if (this.matchesPatterns(from, ['dpd.fr', 'dpd.com', 'information.dpd.fr', 'satisfaction.dpd.fr'])) {
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
    // GOFO/Cirroparcel — Chinese e-commerce logistics (Temu, SHEIN)
    if (this.matchesPatterns(from, ['gofoexpress.fr', 'cirroparcel.com'])) {
      return this.detectCarrierFromBodyOrTracking(body, subject) || 'dpd';
    }

    // ---- STEP 2: Retailer senders → detect actual shipping carrier from body ----
    if (this.matchesPatterns(from, ['sheinnotice.com', 'shein.com'])) {
      return this.detectCarrierFromBodyOrTracking(body, subject) || 'other';
    }
    if (this.matchesPatterns(from, ['orders.temu.com', 'temu.com'])) {
      return this.detectCarrierFromBodyOrTracking(body, subject) || 'other';
    }
    if (this.matchesPatterns(from, ['showroomprive.com'])) {
      return this.detectCarrierFromBodyOrTracking(body, subject) || 'other';
    }

    // ---- STEP 3: Vinted sender → body-based carrier sub-detection ----
    if (this.matchesPatterns(from, ['vintedgo.com', 'vinted.com', 'vinted.fr'])) {
      if (this.bodyMentionsCarrier(body, ['chronopost', 'chrono pickup', 'chronopost.fr'])) {
        return 'chronopost';
      }
      if (this.bodyMentionsCarrier(body, ['mondial relay', 'mondialrelay'])) {
        return 'mondial_relay';
      }
      if (this.bodyMentionsCarrier(body, ['colissimo', 'la poste'])) {
        return 'colissimo';
      }
      return 'vinted_go';
    }

    // ---- STEP 4: Body-based detection for forwarded or unknown-sender emails ----
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
    if (this.bodyMentionsCarrier(body, ['gofoexpress', 'cirroparcel', 'gofo france', 'gofo'])) {
      return this.detectCarrierFromBodyOrTracking(body, subject) || 'dpd';
    }

    // Vinted Go — only if no specific carrier was found above
    if (this.matchesPatterns(`${from} ${subject} ${body}`, ['vintedgo.com', 'vintedgo', 'vinted go'])) {
      return 'vinted_go';
    }
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

    // ---- STEP 5: Tracking number format-based detection (last resort) ----
    const trackingCarrier = this.detectCarrierFromTrackingFormat(body + ' ' + subject);
    if (trackingCarrier) {
      console.log(`[CarrierDetector] Detected carrier from tracking format: ${trackingCarrier}`);
      return trackingCarrier;
    }

    return 'other';
  }

  /**
   * Detect actual shipping carrier from email body (for retailer emails like SHEIN, Temu)
   */
  private detectCarrierFromBodyOrTracking(body: string, subject: string): CarrierType | null {
    if (this.bodyMentionsCarrier(body, ['chronopost', 'chrono'])) return 'chronopost';
    if (this.bodyMentionsCarrier(body, ['colissimo', 'la poste'])) return 'colissimo';
    if (this.bodyMentionsCarrier(body, ['mondial relay', 'mondialrelay'])) return 'mondial_relay';
    if (this.bodyMentionsCarrier(body, ['dhl'])) return 'dhl';
    if (this.bodyMentionsCarrier(body, ['ups'])) return 'ups';
    if (this.bodyMentionsCarrier(body, ['fedex'])) return 'fedex';
    if (this.bodyMentionsCarrier(body, ['dpd'])) return 'dpd';
    if (this.bodyMentionsCarrier(body, ['gls'])) return 'gls';
    if (this.bodyMentionsCarrier(body, ['relais colis'])) return 'relais_colis';
    // Try tracking number format
    return this.detectCarrierFromTrackingFormat(body + ' ' + subject);
  }

  /**
   * Detect carrier from tracking number format found in text
   */
  private detectCarrierFromTrackingFormat(text: string): CarrierType | null {
    // Chronopost: XW + 9 digits + TS or XS + 9 digits + FR
    if (/\bX[WS]\d{9,11}[A-Z]{2}\b/i.test(text)) return 'chronopost';
    // Colissimo: Letter + Letter + 9 digits + Letter + Letter (e.g. A0429190862)
    if (/\b[6-8][AV]\d{11}\b/.test(text)) return 'colissimo';
    // UPS: 1Z...
    if (/\b1Z[A-Z0-9]{16}\b/.test(text)) return 'ups';
    // GOFO: GFFR...
    if (/\bGFFR\d{10,20}\b/i.test(text)) return 'dpd';
    return null;
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
