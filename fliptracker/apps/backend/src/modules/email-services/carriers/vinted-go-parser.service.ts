import { Injectable } from '@nestjs/common';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';

export interface ParsedTrackingInfo {
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other' | 'vinted_go' | 'mondial_relay' | 'chronopost';
  qrCode?: string | null;
  withdrawalCode?: string | null;
  articleId?: string | null;
  marketplace?: string | null;
  type?: 'purchase' | 'sale'; // NEW: distinguish incoming vs outgoing
  // New fields
  productName?: string | null;
  productDescription?: string | null;
  recipientName?: string | null;
  pickupAddress?: string | null;
  pickupDeadline?: Date | null;
}

@Injectable()
export class VintedGoParserService {
  constructor(private shipmentTypeDetector: ShipmentTypeDetectorService) {}

  /**
   * Validate if address is complete enough and NOT a legal/corporate address
   */
  private isAddressComplete(address: string | null): boolean {
    if (!address || address.length < 20) return false;
    if (!/\d{5}/.test(address)) return false; // No postal code
    if (!/\d+\s|rue|avenue|boulevard|place|chemin|allée/i.test(address)) return false;
    
    // Filter out legal/corporate addresses (footer noise)
    if (/RCS|SIRET|SIREN|capital de|SAS|SARL|SA\s/i.test(address)) return false;
    
    return true;
  }

  /**
   * Validate Vinted Go tracking number format (16-20 digits)
   */
  private isValidTrackingNumber(tracking: string | null): boolean {
    if (!tracking) return false;
    // Vinted Go: 16-20 digit number
    return /^\d{16,20}$/.test(tracking);
  }

  /**
   * Extract QR code image URL from email HTML
   */
  private extractQRCodeUrl(body: string): string | null {
    // Pattern 1: img tag with qr/QR in src or alt
    const qrImgPattern = /<img[^>]*(?:src|data-src)=["']([^"']*(?:qr|QR|code|barcode)[^"']*)["'][^>]*>/i;
    const match = body.match(qrImgPattern);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Pattern 2: any image near "QR" or "code" text
    const contextPattern = /(?:QR|code|barcode)[\s\S]{0,200}<img[^>]*(?:src|data-src)=["']([^"']+)["']/i;
    const contextMatch = body.match(contextPattern);
    if (contextMatch && contextMatch[1]) {
      return contextMatch[1].trim();
    }
    
    return null;
  }

  /**
   * Parse Vinted Go emails
   */
  parse(email: { subject: string; body: string; from: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      marketplace: 'vinted',
      carrier: 'vinted_go',
    };

    // Detect type using universal detector
    result.type = this.shipmentTypeDetector.detectType(email);

    // Extract tracking number from subject: "Il est temps de récupérer ton colis ! #1761843602574816"
    const subjectMatch = email.subject.match(/#(\d{16,20})/);
    if (subjectMatch && this.isValidTrackingNumber(subjectMatch[1])) {
      result.trackingNumber = subjectMatch[1];
    }
    
    // Fallback: extract from body if not in subject
    if (!result.trackingNumber) {
      const bodyMatch = email.body.match(/(?:numéro|numero|tracking|suivi)[\s:]*#?(\d{16,20})/i);
      if (bodyMatch && this.isValidTrackingNumber(bodyMatch[1])) {
        result.trackingNumber = bodyMatch[1];
      }
    }
    
    // Extract QR code URL
    const qrCodeUrl = this.extractQRCodeUrl(email.body);
    if (qrCodeUrl) {
      result.qrCode = qrCodeUrl;
    }

    // Extract withdrawal code
    const withdrawalPatterns = [
      /code\s+suivant\s*:\s*<b>([A-Z0-9]+)<\/b>/gi,
      /code\s+suivant\s*:\s*\*\*([A-Z0-9]+)\*\*/gi,
      /code\s+suivant\s*:\s*([A-Z0-9]{4,10})/gi,
    ];

    for (const pattern of withdrawalPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.withdrawalCode = match[1] || match[0].split(':')[1]?.trim().replace(/<[^>]*>/g, '').replace(/\*\*/g, '') || null;
        break;
      }
    }

    // Extract QR code image URL from HTML
    // Vinted Go emails have QR code images with patterns like:
    // <img src="https://..." alt="QR Code" />
    // <img src="data:image/png;base64,..." />
    const qrPatterns = [
      /src=["']([^"']*qr[^"']*)["']/i,
      /alt=["'].*qr.*["'][^>]*src=["']([^"']+)["']/i,
      /src=["'](https?:\/\/[^"']*\/qr[^"']*)["']/i,
      /src=["'](data:image\/[^;]+;base64,[^"\']{50,})["']/i,
    ];

    for (const pattern of qrPatterns) {
      const match = email.body.match(pattern);
      if (match && match[1]) {
        result.qrCode = match[1];
        console.log(`[VintedGoParser] ✅ Found QR code: ${result.qrCode.substring(0, 100)}...`);
        break;
      }
    }

    // Fallback: search for any image URL in QR code context
    if (!result.qrCode) {
      const contextMatch = email.body.match(/qr[\s\S]{0,200}?<img[^>]*src=["']([^"']+)["']/i);
      if (contextMatch && contextMatch[1]) {
        result.qrCode = contextMatch[1];
        console.log(`[VintedGoParser] ✅ Found QR code (context): ${result.qrCode.substring(0, 100)}...`);
      }
    }

    // Extract product name from "Détails de la commande" section
    const productMatch = email.body.match(/<b>([^<]+)<br[^>]*>\d+\.\d+\s*€/);
    if (productMatch) {
      result.productName = productMatch[1]?.trim().replace(/…/, '...') || null;
    }

    // Extract pickup deadline
    const deadlineMatch = email.body.match(/À retirer avant le[\s\S]*?<b>(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (deadlineMatch) {
      const [day, month, year] = deadlineMatch[1].split('/');
      result.pickupDeadline = new Date(`${year}-${month}-${day}`) || null;
    }

    // Extract pickup address - comprehensive multi-pattern approach
    let pickupAddress: string | null = null;
    
    // Pattern 1: Extract from table cell after "Adresse"
    const addressTableMatch = email.body.match(/Adresse[\s\S]{0,100}<\/td>[\s\S]{0,50}<td[^>]*>([\s\S]{1,500}?)<\/td>/i);
    if (addressTableMatch) {
      pickupAddress = addressTableMatch[1]
        .replace(/<br\s*\/?>/gi, ', ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/,\s*,/g, ',')
        .replace(/^,\s*/, '')
        .replace(/,\s*$/, '');
    }
    
    // Pattern 2: Extract from multiple <b> tags (name, street, city)
    if (!pickupAddress || pickupAddress.length < 10) {
      const boldMatches = email.body.match(/Adresse[\s\S]{0,200}?<b>([^<]+)<\/b>[\s\S]{0,50}?<b>([^<]+)<\/b>[\s\S]{0,50}?<b>([^<]+)<\/b>/i);
      if (boldMatches) {
        pickupAddress = [boldMatches[1], boldMatches[2], boldMatches[3]]
          .filter(Boolean)
          .map(s => s.trim())
          .join(', ');
      }
    }
    
    // Pattern 3: Extract full address block (name + street + postal + city)
    if (!pickupAddress || pickupAddress.length < 10) {
      const fullAddressMatch = email.body.match(/([A-Z][A-Z\s&-]+)[\s\S]{0,20}(\d+[^,<]*?)[\s\S]{0,20}(\d{5}\s+[A-Z][A-Z\s-]+)/i);
      if (fullAddressMatch) {
        pickupAddress = `${fullAddressMatch[1].trim()}, ${fullAddressMatch[2].trim()}, ${fullAddressMatch[3].trim()}`;
      }
    }
    
    result.pickupAddress = pickupAddress && pickupAddress.length > 5 ? pickupAddress : null;

    // Validate address quality
    if (result.pickupAddress) {
      const isComplete = this.isAddressComplete(result.pickupAddress);
      if (!isComplete) {
        console.log(`[VintedGoParser] ⚠️  Incomplete address extracted (missing postal code or street): ${result.pickupAddress.substring(0, 50)}...`);
      }
    }

    // Extract recipient name from greeting (after "Bonjour")
    const recipientMatch = email.body.match(/Bonjour\s+([^,<]+)/i);
    if (recipientMatch) {
      result.recipientName = recipientMatch[1]?.trim() || null;
    }

    console.log(`[VintedGoParser] Parsed:`, {
      trackingNumber: result.trackingNumber,
      type: result.type,
      withdrawalCode: result.withdrawalCode,
      productName: result.productName,
      recipientName: result.recipientName,
      pickupDeadline: result.pickupDeadline,
    });

    return result;
  }
}
