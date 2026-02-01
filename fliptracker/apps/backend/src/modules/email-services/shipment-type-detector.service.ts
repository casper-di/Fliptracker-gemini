import { Injectable } from '@nestjs/common';

/**
 * Universal shipment type detector
 * Distinguishes between SALE (outgoing - you send) and PURCHASE (incoming - you receive)
 * Works with ANY email from ANY platform (Vinted, Shopify, Amazon, eBay, Colissimo, etc.)
 */
@Injectable()
export class ShipmentTypeDetectorService {
  /**
   * Detect if email is for a SALE (outgoing shipment) or PURCHASE (incoming delivery)
   */
  detectType(email: { subject: string; body: string; from?: string }): 'sale' | 'purchase' {
    const bodyLower = email.body.toLowerCase();
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
   */
  private isSaleEmail(body: string, subject: string, from: string): boolean {
    // SALE indicators: shipping labels, bordereaux, seller notifications
    const saleKeywords = [
      // French - Bordereaux & Labels
      'bordereau',
      'étiquette d\'expédition',
      'étiquette de transport',
      'bon de transport',
      'imprimer l\'étiquette',
      'télécharger le bordereau',
      'télécharger l\'étiquette',
      'votre étiquette',
      'expédiez votre colis',
      'expédier le colis',
      'déposer votre colis',
      'dépose ton colis',
      'apporter le colis',
      'déposer au point relais',
      
      // English - Shipping Labels
      'shipping label',
      'print label',
      'download label',
      'print shipping label',
      'your shipping label',
      'ship your order',
      'ship the item',
      'drop off package',
      'drop off your package',
      
      // Seller platforms (Shopify, WooCommerce, etc)
      'you sold',
      'you have sold',
      'order to ship',
      'ready to ship',
      'ship by',
      'fulfill order',
      'fulfillment',
      'vous avez vendu',
      'commande à expédier',
      'prêt à expédier',
      'article vendu',
      
      // Vinted/Leboncoin Seller
      'ton article a été acheté',
      'ton article est vendu',
      'your item has been sold',
      'your item sold',
      'prepare your shipment',
      'prépare ton envoi',
      
      // Tracking creation (seller side)
      'create shipping label',
      'créer une étiquette',
      'générer le bordereau',
      'generate label',
      
      // Amazon Seller, eBay Seller
      'seller central',
      'manage your shipment',
      'ship this order',
      'gérer votre expédition',
    ];

    // Check body and subject
    for (const keyword of saleKeywords) {
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
   */
  private isPurchaseEmail(body: string, subject: string, from: string): boolean {
    // PURCHASE indicators: delivery notifications, pickup codes, tracking updates
    const purchaseKeywords = [
      // French - Delivery & Pickup
      'récupérer ton colis',
      'récupérer votre colis',
      'retirer votre colis',
      'retirer ton colis',
      'prêt à être récupéré',
      'disponible au retrait',
      'colis disponible',
      'à retirer avant le',
      'code de retrait',
      'code de récupération',
      'ton colis arrive',
      'votre colis arrive',
      'livraison prévue',
      'en cours de livraison',
      'colis en transit',
      'colis livré',
      
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
      'item purchased',
      
      // QR codes for pickup
      'qr code',
      'scanner le qr',
      'scan qr',
      'présenter le code',
      'show this code',
    ];

    // Check body and subject
    for (const keyword of purchaseKeywords) {
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
