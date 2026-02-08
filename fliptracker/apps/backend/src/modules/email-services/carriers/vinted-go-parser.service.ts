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
    private shipmentTypeDetector: ShipmentTypeDetectorService,
    private addressExtractor: AddressExtractorService,
    private withdrawalCodeExtractor: WithdrawalCodeExtractorService,
    private qrCodeExtractor: QRCodeExtractorService,
    private dateParser: DateParserService,
  

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
    if (!pickupAddress) {
      const addressTableMatch = email.body.match(/Adresse[\s\S]{0,100}<\/td>[\s\S]{0,50}<td[^>]*>([\s\S]{1,500}?)<\/td>/i);
      if (addressTableMatch) {
        pickupAddress = addressTableMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
    
    // Pattern 4: Extract from multiple <b> tags (name, street, city)
    if (!pickupAddress || pickupAddress.length < 10) {
      const boldMatches = email.body.match(/Adresse[\s\S]{0,200}?<b>([^<]+)<\/b>[\s\S]{0,50}?<b>([^<]+)<\/b>[\s\S]{0,50}?<b>([^<]+)<\/b>/i);
      if (boldMatches) {
        pickupAddress = [boldMatches[1], boldMatches[2], boldMatches[3]]
          .filter(Boolean)
          .map(s => s.trim())
          .join('\n');
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
