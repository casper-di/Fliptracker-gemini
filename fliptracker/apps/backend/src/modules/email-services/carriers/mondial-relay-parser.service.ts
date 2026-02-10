import { Injectable } from '@nestjs/common';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';
import { AddressExtractorService } from '../utils/address-extractor.service';
import { WithdrawalCodeExtractorService } from '../utils/withdrawal-code-extractor.service';
import { QRCodeExtractorService } from '../utils/qr-code-extractor.service';
import { DateParserService } from '../utils/date-parser.service';
import { TrackingValidatorService } from '../utils/tracking-validator.service';

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
export class MondialRelayParserService {
  constructor(
    private shipmentTypeDetector: ShipmentTypeDetectorService,
    private addressExtractor: AddressExtractorService,
    private withdrawalCodeExtractor: WithdrawalCodeExtractorService,
    private qrCodeExtractor: QRCodeExtractorService,
    private dateParser: DateParserService,
    private trackingValidator: TrackingValidatorService,
  ) {}
  /**
   * Validate if address is complete enough and NOT a legal/corporate address
   */
  private isAddressComplete(address: string | null): boolean {
    if (!address || address.length < 20) return false;
    if (!/\d{5}/.test(address)) return false;
    if (!/\d+\s|rue|avenue|boulevard|place|chemin|allée/i.test(address)) return false;
    
    // Filter out legal/corporate addresses
    if (/RCS|SIRET|SIREN|capital de|SAS|SARL|SA\s/i.test(address)) return false;
    
    return true;
  }

  /**
   * Validate Mondial Relay tracking format
   */
  private isValidTrackingNumber(tracking: string | null): boolean {
    if (!tracking) return false;
    // Mondial Relay: starts with letters, followed by digits (e.g., VD3000015539, J0213781630)
    return /^[A-Z]{1,3}\d{8,12}$/i.test(tracking) || /^\d{8,12}$/.test(tracking);
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
   * Parse Mondial Relay emails (for Mondial Relay carrier only, not Relais Colis)
   */
  parse(email: { subject: string; body: string; from: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      marketplace: 'vinted',
      carrier: 'mondial_relay',
    };

    // Extract QR code using robust extractor
    result.qrCode = this.qrCodeExtractor.extractQRCode(email.body);

    // Extract tracking number - pattern validation with utility
    const refPatterns = [
      /(?:VD|J)([A-Z0-9]{8,12})/i,
      /VINTED\s+([A-Z0-9]{8,})/i,
      /(?:Référence|Reference|Tracking|Suivi)[\s:]*<?b?>?([A-Z0-9]{8,12})/i,
      /([A-Z]{1,3}\d{8,12})/,
      // Pattern for "colis XXXXXXXX" - 8 digit tracking (common in Mondial Relay)
      /(?:colis|votre colis)\s+(\d{8,12})/i,
      // Pattern from HTML: "Votre colis 86000573 a bien été déposé"
      /colis\s*(?:<[^>]*>)*\s*(\d{8,12})/i,
    ];

    for (const pattern of refPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        const candidate = match[1] || match[0];
        if (this.isValidTrackingNumber(candidate)) {
          result.trackingNumber = candidate;
          break;
        }
      }
    }
    
    // Fallback: extract from JSON-LD structured data if present
    if (!result.trackingNumber) {
      const jsonLdMatch = email.body.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const jsonLd = JSON.parse(jsonLdMatch[1]);
          if (jsonLd.trackingNumber && jsonLd.trackingNumber !== 'RelaisCodePays') {
            result.trackingNumber = jsonLd.trackingNumber;
          }
          // Also extract delivery address from JSON-LD
          if (jsonLd.deliveryAddress) {
            const addr = jsonLd.deliveryAddress;
            const addressParts = [addr.name, addr.streetAddress, `${addr.postalCode} ${addr.addressLocality}`].filter(p => p && p.trim());
            if (addressParts.length > 0 && !result.pickupAddress) {
              result.pickupAddress = addressParts.join('\n');
            }
          }
        } catch (e) {
          // JSON parse failed, skip
        }
      }
    }
    
    // Fallback: extract from subject  
    if (!result.trackingNumber) {
      const subjectMatch = email.subject.match(/(\d{8,12})/);
      if (subjectMatch && this.isValidTrackingNumber(subjectMatch[1])) {
        result.trackingNumber = subjectMatch[1];
      }
    }

    // Extract withdrawal code using specialized extractor
    result.withdrawalCode = this.withdrawalCodeExtractor.extractCode(email.body, email.body);

    // Extract recipient name (usually in greeting or pickup section)
    const recipientPatterns = [
      // Pattern 1: "Bonjour Name" in <h3> tags (common in Mondial Relay)
      /<h3[^>]*>[\s]*Bonjour\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'-]+?)[\s]*<\/h3>/i,
      // Pattern 2: "Bonjour Name!" with ! or . or <
      /Bonjour\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'-]+?)(?:\s*[!.,<&])/i,
      // Pattern 3: "Hello Name"
      /Hello\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'-]+?)(?:\s*[!.,<&])/i,
    ];

    for (const pattern of recipientPatterns) {
      const match = email.body.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Validate: not too short, not a noise word
        if (name.length > 2 && name.length < 50 && !/votre|colis|commande/i.test(name)) {
          result.recipientName = name;
          break;
        }
      }
    }

    // Extract pickup address using comprehensive extractor
    result.pickupAddress = this.addressExtractor.extractAddress(email.body);

    // Extract pickup deadline using smart date parser
    result.pickupDeadline = this.dateParser.parseDate(email.body, email.receivedAt);

    console.log(`[MondialRelayParser] Parsed:`, {
      trackingNumber: result.trackingNumber,
      withdrawalCode: result.withdrawalCode,
      recipientName: result.recipientName,
      pickupAddress: result.pickupAddress,
      pickupDeadline: result.pickupDeadline,
    });

    return result;
  }
}
