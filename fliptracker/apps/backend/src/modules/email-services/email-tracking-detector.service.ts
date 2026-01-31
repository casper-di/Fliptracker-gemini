import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailTrackingDetectorService {
  private trackingKeywords = [
    // Français
    'tracking',
    'suivi',
    'colis',
    'livraison',
    'shipment',
    'numéro de suivi',
    'tracking number',
    'code qr',
    'qr code',
    'point relais',
    'retrait',
    'code de retrait',
    'colissimo',
    'laposte',
    'express',
    'dhl',
    'ups',
    'fedex',
    'parcel',
    'package',
    'delivery',
    'dispatch',
    'shipped',
    'en transit',
    'en cours',
    'remise à',
    'récupérer',
    'adresse de livraison',
    'livré',
    'delivered',
    'amazon',
    'ebay',
    'aliexpress',
    'cdiscount',
  ];

  /**
   * Detect if email is likely a tracking email
   */
  isTrackingEmail(email: { subject: string; from: string; body: string }): boolean {
    const combinedText = `${email.subject} ${email.from} ${email.body}`.toLowerCase();

    // At least 2 keywords for confidence
    const matchCount = this.trackingKeywords.filter(kw => combinedText.includes(kw)).length;

    return matchCount >= 2;
  }

  /**
   * Extract likely tracking/carrier from email
   */
  guessCarrier(email: { subject: string; from: string }): string {
    const combined = `${email.subject} ${email.from}`.toLowerCase();

    if (combined.includes('dhl')) return 'dhl';
    if (combined.includes('ups')) return 'ups';
    if (combined.includes('fedex')) return 'fedex';
    if (combined.includes('laposte') || combined.includes('colissimo')) return 'laposte';
    if (combined.includes('amazon')) return 'amazon';

    return 'other';
  }
}
