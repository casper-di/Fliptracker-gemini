import { Injectable } from '@nestjs/common';

/**
 * Universal shipment type detector
 * Distinguishes between SALE (outgoing - you send) and PURCHASE (incoming - you receive)
 * Works with ANY email from ANY platform (Vinted, Shopify, Amazon, eBay, Colissimo, etc.)
 */
@Injectable()
export class ShipmentTypeDetectorService {
  /**
   * Strip HTML tags from text to enable keyword matching across tags
   */
  private stripHTML(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detect if email is for a SALE (outgoing shipment) or PURCHASE (incoming delivery)
   */
  detectType(email: { subject: string; body: string; from?: string }): 'sale' | 'purchase' {
    // Strip HTML tags BEFORE matching keywords - this is critical because
    // emails like "Votre colis <strong>a été pris en charge</strong>" would not
    // match "votre colis a été pris en charge" with HTML tags present
    const bodyLower = this.stripHTML(email.body).toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    const fromLower = email.from?.toLowerCase() || '';
    
    // Check for SALE indicators first (more specific)
    if (this.isSaleEmail(bodyLower, subjectLower, fromLower)) {
      return 'sale';
    }
    
    // Check for PURCHASE indicators
    if (this.isPurchaseEmail(bodyLower, subjectLower, fromLower)) {
      return 'purchase';
    }
    
    // Default: assume purchase (safer - most emails are incoming deliveries)
    return 'purchase';
  }

  /**
   * Check if email indicates a SALE (you are the seller/sender)
   * Based on Fliptracker Mail Intelligence patterns for French market
   */
  private isSaleEmail(body: string, subject: string, from: string): boolean {
    // SELLER indicators from prompt - strong signals
    const strongSellerKeywords = [
      // French - Seller specific (from prompt)
      'vous avez expédié',
      'vous avez expédi\u00e9',
      'bordereau',
      '\u00e9tiquette cr\u00e9\u00e9e',
      'etiquette creee',
      'votre colis a \u00e9t\u00e9 pris en charge',
      'votre colis a ete pris en charge',
      'remise au transporteur',
      
      // Deposit confirmation (outgoing shipment)
      'a bien \u00e9t\u00e9 d\u00e9pos\u00e9',
      'a bien ete depose',
      'confirmons le d\u00e9p\u00f4t',
      'confirmons le depot',
      'd\u00e9p\u00f4t de votre colis',
      'depot de votre colis',
      'colis d\u00e9pos\u00e9',
      'colis depose',
      
      // Deposit proof (outgoing shipment confirmation)
      'preuve de d\u00e9p\u00f4t',
      'preuve de depot',
      'votre preuve de d\u00e9p\u00f4t',
      
      // Label/shipment creation
      '\u00e9tiquette d\'exp\u00e9dition',
      'etiquette d\'expedition',
      '\u00e9tiquette de transport',
      'bon de transport',
      'imprimer l\'\u00e9tiquette',
      'imprimer l\'etiquette',
      't\u00e9l\u00e9charger le bordereau',
      'telecharger le bordereau',
      'votre \u00e9tiquette',
      'votre etiquette',
      'exp\u00e9diez votre colis',
      'expediez votre colis',
      'exp\u00e9dier le colis',
      'd\u00e9poser votre colis',
      'deposer votre colis',
      'd\u00e9pose ton colis',
      'd\u00e9poser au point relais',
      
      // Marketplace sales
      'ton article a \u00e9t\u00e9 achet\u00e9',
      'ton article est vendu',
      'your item has been sold',
      'prepare your shipment',
      'pr\u00e9pare ton envoi',
      'prepare ton envoi',
      
      // Seller platforms
      'vous avez vendu',
      'commande \u00e0 exp\u00e9dier',
      'commande a expedier',
      'pr\u00eat \u00e0 exp\u00e9dier',
      'pret a expedier',
      'article vendu',
      
      // English equivalents
      'shipping label',
      'print label',
      'ship your order',
      'drop off package',
      'you sold',
      'order to ship',
      'package dropped off',
      'shipment received',
    ];

    // Check body and subject for strong signals
    for (const keyword of strongSellerKeywords) {
      if (body.includes(keyword) || subject.includes(keyword)) {
        return true;
      }
    }
    
    // Check sender domains for seller platforms
    const sellerDomains = [
      'shopify.com',
      'woocommerce.com',
      'sellercentral.amazon',
      'ebay.com/seller',
      'etsy.com/seller',
    ];
    
    for (const domain of sellerDomains) {
      if (from.includes(domain)) {
        // If from seller platform + contains shipment keywords
        if (body.includes('ship') || body.includes('expédi') || body.includes('label')) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if email indicates a PURCHASE (you are the buyer/recipient)
   * Based on Fliptracker Mail Intelligence patterns for French market
   */
  private isPurchaseEmail(body: string, subject: string, from: string): boolean {
    // BUYER indicators from prompt - strong signals
    const strongBuyerKeywords = [
      // French - Buyer specific (from prompt)
      'votre commande',
      'vous allez être livré',
      'vous allez etre livre',
      'livraison en cours',
      'expédié par',
      'expedie par',
      
      // Delivery & Pickup
      'récupérer ton colis',
      'recuperer ton colis',
      'récupérer votre colis',
      'recuperer votre colis',
      'retirer votre colis',
      'retirer ton colis',
      'prêt à être récupéré',
      'pret a etre recupere',
      'disponible au retrait',
      'colis disponible',
      'à retirer avant le',
      'a retirer avant le',
      'code de retrait',
      'code de récupération',
      'code de recuperation',
      'ton colis arrive',
      'votre colis arrive',
      'livraison prévue',
      'livraison prevue',
      'en cours de livraison',
      'colis en transit',
      'colis livré',
      'colis livre',
      'il est temps de récupérer',
      'il est temps de recuperer',
      
      // English - Delivery & Pickup
      'pickup your parcel',
      'collect your parcel',
      'ready for pickup',
      'available for pickup',
      'pickup code',
      'withdrawal code',
      'your parcel is ready',
      'your package is ready',
      'delivery scheduled',
      'out for delivery',
      'in transit',
      'delivered',
      'tracking update',
      
      // Order confirmations (buyer side)
      'your order',
      'votre commande',
      'order confirmation',
      'confirmation de commande',
      'merci pour votre achat',
      'thank you for your purchase',
      'your purchase',
      'votre achat',
      
      // Marketplaces (buyer notifications)
      'ton achat',
      'your item',
      'votre article',
      'article acheté',
      'article achete',
      'item purchased',
      'you purchased',
      'vous avez acheté',
      'vous avez achete',
      
      // QR codes for pickup (buyer feature)
      'qr code',
      'scanner le qr',
      'scan qr',
      'présenter le code',
      'presenter le code',
      'show this code',
    ];

    // Check body and subject for strong signals
    for (const keyword of strongBuyerKeywords) {
      if (body.includes(keyword) || subject.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get confidence score for type detection (0-100)
   * Useful for debugging and future ML improvements
   */
  getConfidence(email: { subject: string; body: string; from?: string }): {
    type: 'sale' | 'purchase';
    confidence: number;
    reason: string;
  } {
    const type = this.detectType(email);
    const bodyLower = email.body.toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    
    let confidence = 50; // baseline
    let reason = 'Default classification';
    
    if (type === 'sale') {
      if (bodyLower.includes('bordereau') || bodyLower.includes('shipping label')) {
        confidence = 95;
        reason = 'Contains shipping label/bordereau keywords';
      } else if (bodyLower.includes('expédier') || bodyLower.includes('ship your')) {
        confidence = 85;
        reason = 'Contains shipment action keywords';
      } else if (bodyLower.includes('vendu') || bodyLower.includes('sold')) {
        confidence = 80;
        reason = 'Contains sale confirmation keywords';
      }
    } else {
      if (bodyLower.includes('code de retrait') || bodyLower.includes('withdrawal code')) {
        confidence = 98;
        reason = 'Contains withdrawal/pickup code';
      } else if (bodyLower.includes('récupérer') || bodyLower.includes('pickup')) {
        confidence = 90;
        reason = 'Contains pickup keywords';
      } else if (bodyLower.includes('votre commande') || bodyLower.includes('your order')) {
        confidence = 75;
        reason = 'Contains order confirmation keywords';
      }
    }
    
    return { type, confidence, reason };
  }
}
