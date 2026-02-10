import { Injectable } from '@nestjs/common';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';
import { AddressExtractorService } from '../utils/address-extractor.service';
import { WithdrawalCodeExtractorService } from '../utils/withdrawal-code-extractor.service';
import { QRCodeExtractorService } from '../utils/qr-code-extractor.service';
import { DateParserService } from '../utils/date-parser.service';

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
  constructor(
    private shipmentTypeDetector: ShipmentTypeDetectorService,
    private addressExtractor: AddressExtractorService,
    private withdrawalCodeExtractor: WithdrawalCodeExtractorService,
    private qrCodeExtractor: QRCodeExtractorService,
    private dateParser: DateParserService,
  ) {}

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
    
    // Fallback: extract from body (handle HTML tags between label and number)
    if (!result.trackingNumber) {
      // Pattern 1: With potential HTML tags between
      const bodyMatch = email.body.match(/(?:numéro|numero|tracking|suivi)[^>]{0,100}>(\d{16,20})</i);
      if (bodyMatch && this.isValidTrackingNumber(bodyMatch[1])) {
        result.trackingNumber = bodyMatch[1];
      }
    }
    
    // Fallback 2: Simple pattern without HTML
    if (!result.trackingNumber) {
      const simpleMatch = email.body.match(/(?:numéro|numero|tracking|suivi)[\s:]*#?(\d{16,20})/i);
      if (simpleMatch && this.isValidTrackingNumber(simpleMatch[1])) {
        result.trackingNumber = simpleMatch[1];
      }
    }
    
    // Extract QR code URL using robust extractor
    result.qrCode = this.qrCodeExtractor.extractQRCode(email.body);

    // Extract withdrawal code using specialized extractor
    result.withdrawalCode = this.withdrawalCodeExtractor.extractCode(email.body, email.body);

    // Extract product name from "Détails de la commande" section
    // Pattern: <b>Product Name<br>Price €</b>
    const productPatterns = [
      /<b>([^<]+)<br[^>]*>\d+\.\d+\s*€<\/b>/i,
      /Détails de la commande[\s\S]{0,200}?<b>([^<]+)<br/i,
    ];
    
    for (const pattern of productPatterns) {
      const match = email.body.match(pattern);
      if (match && match[1]) {
        result.productName = match[1]?.trim().replace(/…/, '...') || null;
        break;
      }
    }

    // Extract pickup deadline using smart date parser
    result.pickupDeadline = this.dateParser.parseDate(email.body, email.receivedAt);

    // Extract pickup address using comprehensive address extractor
    result.pickupAddress = this.addressExtractor.extractAddress(email.body);
    
    // Fallback: Vinted Go specific address extraction from "Adresse" block
    if (!result.pickupAddress) {
      // Pattern 1: Vinted Go specific - extract all content between "Adresse" and next section
      const vintedGoAddressMatch = email.body.match(/block-header[^>]*>(?:\s*)Adresse(?:\s*)<\/div>([\s\S]{0,800}?)(?:<div[^>]*class=["']block-header|D[eé]tails de la commande|Horaires d'ouverture|Horaires d&#39;ouverture)/i);
      if (vintedGoAddressMatch) {
        const addressHtml = vintedGoAddressMatch[1];
        const addressParts: string[] = [];
        
        // Extract text from <b> tags (which may contain <a> tags for address links)
        const boldMatches = addressHtml.matchAll(/<b[^>]*>([\s\S]*?)<\/b>/gi);
        for (const match of boldMatches) {
          // Strip inner HTML tags but keep text content
          const text = match[1]
            .replace(/<a[^>]*>/gi, '')
            .replace(/<\/a>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .trim();
          if (text && text.length > 0) {
            // Split by newlines and add each non-empty part
            text.split('\n').forEach(part => {
              const cleaned = part.trim();
              if (cleaned.length > 0) {
                addressParts.push(cleaned);
              }
            });
          }
        }
        
        if (addressParts.length >= 2) {
          result.pickupAddress = addressParts.join('\n');
          console.log(`[VintedGoParser] Extracted address from Adresse block: ${result.pickupAddress}`);
        }
      }
    }
    
    // Pattern 2: Table-based address
    if (!result.pickupAddress) {
      const addressTableMatch = email.body.match(/Adresse[\s\S]{0,100}<\/td>[\s\S]{0,50}<td[^>]*>([\s\S]{1,500}?)<\/td>/i);
      if (addressTableMatch) {
        result.pickupAddress = addressTableMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
    
    // Pattern 3: Extract from multiple <b> tags (name, street, city)
    if (!result.pickupAddress || result.pickupAddress.length < 10) {
      const boldMatches = email.body.match(/Adresse[\s\S]{0,200}?<b>([^<]+)<\/b>[\s\S]{0,50}?<b>([^<]+)<\/b>[\s\S]{0,50}?<b>([^<]+)<\/b>/i);
      if (boldMatches) {
        result.pickupAddress = [boldMatches[1], boldMatches[2], boldMatches[3]]
          .filter(Boolean)
          .map(s => s.trim())
          .join('\n');
      }
    }
    
    // Validate address length
    if (result.pickupAddress && result.pickupAddress.length <= 5) {
      result.pickupAddress = null;
    }

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
