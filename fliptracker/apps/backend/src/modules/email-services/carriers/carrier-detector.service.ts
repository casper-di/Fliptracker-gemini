import { Injectable } from '@nestjs/common';

export type CarrierType = 'vinted_go' | 'mondial_relay' | 'chronopost' | 'other';

@Injectable()
export class CarrierDetectorService {
  /**
   * Detect carrier from sender email and subject
   */
  detectCarrier(email: { from: string; subject: string }): CarrierType {
    const from = email.from.toLowerCase();
    const subject = email.subject.toLowerCase();

    // Vinted Go - handles both VintedGo and Vinted Go parcels
    if (
      from.includes('vintedgo.com') ||
      from.includes('vinted.com') ||
      subject.includes('vintedgo')
    ) {
      return 'vinted_go';
    }

    // Mondial Relay / Relais Colis
    if (
      from.includes('mondialrelay.fr') ||
      from.includes('relaiscolis.com') ||
      subject.includes('mondial relay') ||
      subject.includes('point relais')
    ) {
      return 'mondial_relay';
    }

    // Chronopost Pickup
    if (
      from.includes('chronopost') ||
      from.includes('pickup.fr') ||
      subject.includes('chronopost')
    ) {
      return 'chronopost';
    }

    return 'other';
  }
}
