import { Injectable } from '@nestjs/common';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';

export interface ParsedTrackingInfo {
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other' | 'vinted_go' | 'mondial_relay' | 'chronopost';
  type?: 'purchase' | 'sale';
  qrCode?: string | null;
  withdrawalCode?: string | null;
  articleId?: string | null;
  marketplace?: string | null;
  // New fields
  productName?: string | null;
  productDescription?: string | null;
  recipientName?: string | null;
  pickupAddress?: string | null;
  pickupDeadline?: Date | null;
}

@Injectable()
export class ChronopostParserService {
  constructor(private shipmentTypeDetector: ShipmentTypeDetectorService) {}

  /**
   * Validate if address is complete enough and NOT a legal/corporate address
   */
  private isAddressComplete(address: string | null): boolean {
    if (!address || address.length < 20) return false;
    if (!/\d{5}/.test(address)) return false;
    if (!/\d+\s|rue|avenue|boulevard|place|chemin|allée/i.test(address)) return false;
    
    // Filter out legal/corporate addresses (Chronopost SAS footer)
    if (/RCS|SIRET|SIREN|capital de|SAS|SARL|SA\s|Chronopost SAS/i.test(address)) return false;
    
    return true;
  }

  /**
   * Validate Chronopost tracking format (e.g., XW261547816TS, 3436603419)
   */
  private isValidTrackingNumber(tracking: string | null): boolean {
    if (!tracking) return false;
    // Format 1: Letters + digits + letters (e.g., XW261547816TS)
    // Format 2: 10 digits (e.g., 3436603419)
    return /^[A-Z]{2}\d{9,11}[A-Z]{2}$/i.test(tracking) || /^\d{10}$/.test(tracking);
  }

  /**
   * Extract QR code image URL from email HTML
   */
  private extractQRCodeUrl(body: string): string | null {
    const qrImgPattern = /<img[^>]*(?:src|data-src)=["']([^"']*(?:qr|QR|code|barcode)[^"']*)["'][^>]*>/i;
    const match = body.match(qrImgPattern);
    if (match && match[1]) return match[1].trim();
    
    const contextPattern = /(?:QR|code|barcode)[\s\S]{0,200}<img[^>]*(?:src|data-src)=["']([^"']+)["']/i;
    const contextMatch = body.match(contextPattern);
    if (contextMatch && contextMatch[1]) return contextMatch[1].trim();
    
    return null;
  }

  /**
   * Parse Chronopost emails
   */
  parse(email: { subject: string; body: string; from: string; receivedAt: Date }): ParsedTrackingInfo {
    // Detect marketplace from email content
    let marketplace: string | null = null;
    if (/vinted/i.test(email.subject) || /vinted/i.test(email.body)) {
      marketplace = 'vinted';
    } else if (/leboncoin/i.test(email.subject) || /leboncoin/i.test(email.body)) {
      marketplace = 'leboncoin';
    } else if (/vestiaire collective/i.test(email.subject) || /vestiaire collective/i.test(email.body)) {
      marketplace = 'vestiaire_collective';
    }
    
    const result: ParsedTrackingInfo = {
      marketplace,
      carrier: 'chronopost',
      type: this.shipmentTypeDetector.detectType(email),
    };

    // Extract QR code image URL
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
        console.log(`[ChronopostParser] ✅ Found QR code: ${result.qrCode.substring(0, 100)}...`);
        break;
      }
    }

    // Fallback: search for any image URL in QR code context
    if (!result.qrCode) {
      const contextMatch = email.body.match(/qr[\s\S]{0,200}?<img[^>]*src=["']([^"']+)["']/i);
      if (contextMatch && contextMatch[1]) {
        result.qrCode = contextMatch[1];
        console.log(`[ChronopostParser] ✅ Found QR code (context): ${result.qrCode.substring(0, 100)}...`);
      }
    }

    // Extract tracking number - Chronopost format: XW261547816TS or 3436603419
    const trackingPatterns = [
      /(?:colis|tracking|suivi)[^<]{0,50}<[^>]*>([A-Z]{2}\d{9,11}[A-Z]{2})/i,
      /Votre colis VINTED n.*?<a[^>]*>([A-Z0-9]{10,})/i,
      /(?:numéro|numero|tracking|suivi)[\s:]*([A-Z]{2}\d{9,11}[A-Z]{2})/i,
      /(\d{10})/, // 10-digit tracking numbers
      /([A-Z]{2}\d{9,11}[A-Z]{2})/, // Generic format
    ];

    for (const pattern of trackingPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        const candidate = match[1];
        if (this.isValidTrackingNumber(candidate)) {
          result.trackingNumber = candidate;
          break;
        }
      }
    }
    
    // Extract QR code URL
    const qrCodeUrl = this.extractQRCodeUrl(email.body);
    if (qrCodeUrl) {
      result.qrCode = qrCodeUrl;
    }

    // Extract withdrawal code - typically 6 digits
    const withdrawalPatterns = [
      /Code de retrait[\s\S]*?(\d{6})/i,
      /<span[^>]*>(\d{6})<\/span>/i,
    ];

    for (const pattern of withdrawalPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.withdrawalCode = match[1];
        break;
      }
    }

    // Extract recipient name from greeting
    const recipientMatch = email.body.match(/Bonjour\s+([A-Z][A-Z\s]*)\s*!/i);
    if (recipientMatch) {
      result.recipientName = recipientMatch[1]?.trim() || null;
    }

    // Extract pickup address - comprehensive patterns
    let pickupAddress: string | null = null;
    
    // Pattern 1: "Votre relais Pickup" section with strong tag
    const pickupMatch = email.body.match(/Votre relais Pickup[\s\S]{0,200}<strong>([^<]{5,80})<\/strong>[\s\S]{0,100}?(\d+[^<]{10,150}?(?:\d{5}|[A-Z]{2,20}))/i);
    if (pickupMatch) {
      pickupAddress = `${pickupMatch[1].trim()}, ${pickupMatch[2].trim().replace(/\s+/g, ' ')}`;
    }
    
    // Pattern 2: Extract from table structure
    if (!pickupAddress || pickupAddress.length < 10) {
      const tableMatch = email.body.match(/(?:adresse|address)[\s\S]{0,100}<\/td>[\s\S]{0,50}<td[^>]*>([\s\S]{1,500}?)<\/td>/i);
      if (tableMatch) {
        pickupAddress = tableMatch[1]
          .replace(/<br\s*\/?>/gi, ', ')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/,\s*,/g, ',')
          .replace(/^,\s*/, '')
          .replace(/,\s*$/, '');
      }
    }
    
    // Pattern 3: General address with postal code
    if (!pickupAddress || pickupAddress.length < 10) {
      const generalMatch = email.body.match(/([A-Z][A-Z\s&\'-]+)[\s\S]{0,30}(\d+[^<]{5,100}?\d{5}\s+[A-Z][A-Z\s-]+)/i);
      if (generalMatch) {
        pickupAddress = `${generalMatch[1].trim()}, ${generalMatch[2].trim().replace(/\s+/g, ' ')}`;
      }
    }
    
    result.pickupAddress = pickupAddress && pickupAddress.length > 5 ? pickupAddress : null;

    // Validate address quality
    if (result.pickupAddress) {
      const isComplete = this.isAddressComplete(result.pickupAddress);
      if (!isComplete) {
        console.log(`[ChronopostParser] ⚠️  Incomplete address extracted: ${result.pickupAddress.substring(0, 50)}...`);
      }
    }

    // Extract pickup deadline
    const deadlinePatterns = [
      /jusqu'au\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i,
      /available[\s\S]*?(\d{1,2})\s+(\w+)\s+(\d{4})/i,
    ];

    for (const pattern of deadlinePatterns) {
      const match = email.body.match(pattern);
      if (match) {
        try {
          const [, day, month, year] = match;
          result.pickupDeadline = new Date(`${year}-${month}-${day}`) || null;
        } catch (e) {
          // Ignore parsing errors
        }
        break;
      }
    }

    console.log(`[ChronopostParser] Parsed:`, {
      trackingNumber: result.trackingNumber,
      withdrawalCode: result.withdrawalCode,
      recipientName: result.recipientName,
      pickupAddress: result.pickupAddress,
      pickupDeadline: result.pickupDeadline,
    });

    return result;
  }
}
