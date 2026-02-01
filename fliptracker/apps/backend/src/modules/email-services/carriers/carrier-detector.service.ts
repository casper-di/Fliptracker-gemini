import { Injectable } from '@nestjs/common';

export type CarrierType = 
  | 'vinted_go' 
  | 'mondial_relay' 
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
    const combined = `${from} ${subject} ${body}`;

    // Vinted Go - handles both VintedGo and Vinted Go parcels
    if (this.matchesPatterns(combined, ['vintedgo.com', 'vinted.com', 'vintedgo', 'vinted go'])) {
      return 'vinted_go';
    }

    // Mondial Relay / Relais Colis
    if (this.matchesPatterns(combined, [
      'mondialrelay.fr', 
      'relaiscolis.com', 
      'mondial relay', 
      'point relais mondial',
      'mondialrelay',
    ])) {
      return 'mondial_relay';
    }

    // Chronopost Pickup
    if (this.matchesPatterns(combined, [
      'chronopost.fr',
      'chronopost.com',
      'pickup.fr',
      'chronopost',
      'chrono relais',
    ])) {
      return 'chronopost';
    }

    // Colissimo / La Poste
    if (this.matchesPatterns(combined, [
      'colissimo.fr',
      'laposte.fr',
      'laposte.net',
      'colissimo',
      'la poste',
      'bureau de poste',
      'point retrait colissimo',
    ])) {
      return 'colissimo';
    }

    // DHL (Express, eCommerce, Parcel)
    if (this.matchesPatterns(combined, [
      'dhl.com',
      'dhl.fr',
      'dhl.de',
      'dhl express',
      'dhl ecommerce',
      'dhl parcel',
      'dhl delivery',
    ])) {
      return 'dhl';
    }

    // UPS
    if (this.matchesPatterns(combined, [
      'ups.com',
      'ups.fr',
      'united parcel',
      'ups delivery',
      'ups tracking',
      '1z', // UPS tracking format
    ])) {
      return 'ups';
    }

    // FedEx
    if (this.matchesPatterns(combined, [
      'fedex.com',
      'fedex.fr',
      'fedex express',
      'fedex ground',
      'fedex delivery',
      'fedex tracking',
    ])) {
      return 'fedex';
    }

    // DPD (Dynamic Parcel Distribution)
    if (this.matchesPatterns(combined, [
      'dpd.fr',
      'dpd.com',
      'dpd parcel',
      'dpd delivery',
      'dpd relay',
    ])) {
      return 'dpd';
    }

    // Colis Privé
    if (this.matchesPatterns(combined, [
      'colisprive.fr',
      'colisprive.com',
      'colis privé',
      'colis prive',
      'pick&ship',
    ])) {
      return 'colis_prive';
    }

    // GLS (General Logistics Systems)
    if (this.matchesPatterns(combined, [
      'gls-france.com',
      'gls.fr',
      'gls parcel',
      'gls delivery',
      'gls relay',
    ])) {
      return 'gls';
    }

    // Amazon Logistics
    if (this.matchesPatterns(combined, [
      'amazon.fr',
      'amazon.com',
      'amazon logistics',
      'livraison amazon',
      'transporteur amazon',
      'tba', // Amazon tracking prefix
    ])) {
      return 'amazon_logistics';
    }

    return 'other';
  }

  /**
   * Helper: Check if combined string matches any pattern
   */
  private matchesPatterns(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }

  /**
   * Get carrier display name in French
   */
  getCarrierDisplayName(carrier: CarrierType): string {
    const names: Record<CarrierType, string> = {
      vinted_go: 'Vinted Go',
      mondial_relay: 'Mondial Relay',
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
