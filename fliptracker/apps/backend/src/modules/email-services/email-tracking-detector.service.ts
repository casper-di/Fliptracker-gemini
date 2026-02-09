import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailTrackingDetectorService {
  private trackingKeywords = [
    // Français
    'tracking', 'suivi', 'colis', 'livraison', 'shipment',
    'numéro de suivi', 'tracking number', 'code qr', 'qr code',
    'point relais', 'retrait', 'code de retrait',
    'colissimo', 'laposte', 'express', 'dhl', 'ups', 'fedex',
    'parcel', 'package', 'delivery', 'dispatch', 'shipped',
    'en transit', 'en cours', 'remise à', 'récupérer',
    'adresse de livraison', 'livré', 'delivered',
    'bordereau', 'étiquette', 'expédié', 'expédition',
    'vinted', 'mondial relay', 'chronopost', 'relais colis',
  ];

  // Negative signals: emails that are NOT about tracking
  private promoKeywords = [
    'unsubscribe', 'se désabonner', 'désinscrire', 'newsletter',
    'offre spéciale', 'special offer', 'promotion', '% off',
    '% de réduction', 'soldes', 'vente flash', 'flash sale',
    'code promo', 'coupon', 'parrainage', 'referral',
    'ne manquez pas', 'don\'t miss', 'limited time',
    'view in browser', 'voir dans le navigateur',
    'email preferences', 'préférences email',
    'manage subscriptions', 'gérer les abonnements',
  ];

  /**
   * Detect if email is likely a tracking/transactional email (not promo)
   */
  isTrackingEmail(email: { subject: string; from: string; body: string }): boolean {
    const combinedText = `${email.subject} ${email.from} ${email.body}`.toLowerCase();

    // Check promo signals first (negative filter)
    const promoCount = this.promoKeywords.filter(kw => combinedText.includes(kw)).length;
    if (promoCount >= 3) {
      return false; // Very likely promo/newsletter
    }

    // At least 2 tracking keywords for confidence
    const matchCount = this.trackingKeywords.filter(kw => combinedText.includes(kw)).length;

    // If strong promo signals, require more tracking keywords
    if (promoCount >= 1) {
      return matchCount >= 4; // Need stronger tracking signal
    }

    return matchCount >= 2;
  }

  /**
   * Check if email is promotional/newsletter (to be ignored)
   */
  isPromoEmail(email: { subject: string; from: string; body: string }): boolean {
    const combinedText = `${email.subject} ${email.from} ${email.body}`.toLowerCase();
    const promoCount = this.promoKeywords.filter(kw => combinedText.includes(kw)).length;
    const trackingCount = this.trackingKeywords.filter(kw => combinedText.includes(kw)).length;

    // Strong promo signal and weak tracking signal
    return promoCount >= 2 && trackingCount < 3;
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
