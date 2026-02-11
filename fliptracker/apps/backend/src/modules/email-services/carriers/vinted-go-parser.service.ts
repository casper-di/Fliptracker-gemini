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
   * Validate Vinted Go tracking number format (16-20 digits or alphanumeric from link)
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
   * Detect if email body is plain text (forwarded Gmail) vs HTML
   */
  private isPlainText(body: string): boolean {
    // Plain text forwarded emails have few or no HTML tags
    const htmlTagCount = (body.match(/<[a-z][^>]*>/gi) || []).length;
    return htmlTagCount < 5;
  }

  /**
   * Parse Vinted Go emails (supports both HTML and plain text forwarded emails)
   */
  parse(email: { subject: string; body: string; from: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      marketplace: 'vinted',
      carrier: 'vinted_go',
    };

    const isPlainText = this.isPlainText(email.body);
    console.log(`[VintedGoParser] Email format: ${isPlainText ? 'PLAIN TEXT (forwarded)' : 'HTML'}`);

    // Detect type using universal detector
    result.type = this.shipmentTypeDetector.detectType(email);

    // Extract tracking number from subject: "Il est temps de récupérer ton colis ! #1761843602574816"
    const subjectMatch = email.subject.match(/#(\d{16,20})/);
    if (subjectMatch && this.isValidTrackingNumber(subjectMatch[1])) {
      result.trackingNumber = subjectMatch[1];
    }
    
    // Fallback: extract from body — plain text format: "Numéro de suivi : 1768577912130348"
    if (!result.trackingNumber) {
      const simpleMatch = email.body.match(/(?:numéro|numero|num[eé]ro)\s*(?:de\s+)?(?:suivi|tracking)[\s:]*#?(\d{16,20})/i);
      if (simpleMatch && this.isValidTrackingNumber(simpleMatch[1])) {
        result.trackingNumber = simpleMatch[1];
      }
    }
    
    // Fallback 2: HTML format with tags between
    if (!result.trackingNumber) {
      const bodyMatch = email.body.match(/(?:numéro|numero|tracking|suivi)[^>]{0,100}>(\d{16,20})</i);
      if (bodyMatch && this.isValidTrackingNumber(bodyMatch[1])) {
        result.trackingNumber = bodyMatch[1];
      }
    }

    // Fallback 3: Extract from vintedgo.com/tracking/ link
    if (!result.trackingNumber) {
      const trackingLinkMatch = email.body.match(/vintedgo\.com\/[a-z]{2}\/tracking\/([A-Z0-9]{10,20})/i);
      if (trackingLinkMatch) {
        result.trackingNumber = trackingLinkMatch[1];
        console.log(`[VintedGoParser] Extracted tracking from vintedgo link: ${result.trackingNumber}`);
      }
    }
    
    // Extract QR code URL
    if (isPlainText) {
      // For plain text: look for vintedgo QR code URLs in the body text
      result.qrCode = this.extractPlainTextQRCode(email.body);
    } else {
      result.qrCode = this.qrCodeExtractor.extractQRCode(email.body);
    }

    // Extract withdrawal code
    result.withdrawalCode = this.withdrawalCodeExtractor.extractCode(email.body, email.body);

    // Extract product name and price
    if (isPlainText) {
      this.extractPlainTextProductPrice(email.body, result);
    } else {
      this.extractHtmlProductPrice(email.body, result);
    }

    // Extract pickup deadline using smart date parser
    result.pickupDeadline = this.dateParser.parseDate(email.body, email.receivedAt);

    // Extract pickup address
    if (isPlainText) {
      result.pickupAddress = this.extractPlainTextAddress(email.body);
    } else {
      result.pickupAddress = this.addressExtractor.extractAddress(email.body);
      
      // Fallback: Vinted Go specific address extraction from "Adresse" block
      if (!result.pickupAddress) {
        result.pickupAddress = this.extractVintedGoHtmlAddress(email.body);
      }
      
      // Fallback: Table-based address
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
      
      // Fallback: Multiple <b> tags
      if (!result.pickupAddress || result.pickupAddress.length < 10) {
        const boldMatches = email.body.match(/Adresse[\s\S]{0,200}?<b>([^<]+)<\/b>[\s\S]{0,50}?<b>([^<]+)<\/b>[\s\S]{0,50}?<b>([^<]+)<\/b>/i);
        if (boldMatches) {
          result.pickupAddress = [boldMatches[1], boldMatches[2], boldMatches[3]]
            .filter(Boolean)
            .map(s => s.trim())
            .join('\n');
        }
      }
    }
    
    // Clean address 
    if (result.pickupAddress) {
      result.pickupAddress = this.cleanAddress(result.pickupAddress);
    }
    
    // Validate address
    if (result.pickupAddress && result.pickupAddress.length <= 5) {
      result.pickupAddress = null;
    }

    // Extract recipient name from greeting (after "Bonjour")
    const recipientMatch = email.body.match(/Bonjour\s+([^,<!\n]+)/i);
    if (recipientMatch) {
      result.recipientName = recipientMatch[1]?.trim() || null;
    }

    console.log(`[VintedGoParser] Parsed:`, {
      trackingNumber: result.trackingNumber,
      type: result.type,
      withdrawalCode: result.withdrawalCode,
      productName: result.productName,
      estimatedValue: (result as any).estimatedValue,
      marketplace: result.marketplace,
      recipientName: result.recipientName,
      pickupAddress: result.pickupAddress?.substring(0, 60),
      qrCode: result.qrCode ? 'found' : 'null',
    });

    return result;
  }

  /**
   * Extract QR code URL from plain text forwarded email.
   * In forwarded emails, QR images become [image: QR code] but URLs may still be in text.
   */
  private extractPlainTextQRCode(body: string): string | null {
    // Look for vintedgo QR code URLs (these may appear as plain text links)
    const qrUrlPatterns = [
      /(?:http[s]?:\/\/)?p\.vintedgo\.com\/public\/v1\/qr_codes\/([^\s"'<>]+)/i,
      /(?:http[s]?:\/\/)?vintedgo\.com\/[^\/]*\/qr_codes\/([^\s"'<>]+)/i,
    ];
    
    for (const pattern of qrUrlPatterns) {
      const match = body.match(pattern);
      if (match) {
        const url = match[0].startsWith('http') ? match[0] : `http://${match[0]}`;
        console.log(`[VintedGoParser] Found plain text QR URL: ${url.substring(0, 80)}`);
        return url;
      }
    }
    
    // Look for wallet pass URLs (backup - the pass contains the QR)
    const walletMatch = body.match(/(http[s]?:\/\/p\.vintedgo\.com\/communications\/wallet_pass\/[^\s"'<>]+)/i);
    if (walletMatch) {
      console.log(`[VintedGoParser] Found wallet pass URL as QR fallback`);
      return walletMatch[1];
    }
    
    return null;
  }

  /**
   * Extract product name and price from plain text: "*Zwarte Jas1.00 €*"
   * Gmail forwards convert HTML bold to *text* format.
   */
  private extractPlainTextProductPrice(body: string, result: ParsedTrackingInfo): void {
    // Pattern: "Détails de la commande\n\n*Product Name Price €*"
    const patterns = [
      /[Dd][eé]tails?\s+de\s+la\s+commande\s*\n+\*([^*]+?)(\d+[\.,]\d{2})\s*€\*/,
      /[Dd][eé]tails?\s+de\s+la\s+commande\s*\n+\*([^*]+?)\s+(\d+[\.,]\d{2})\s*€\*/,
      // Fallback: any bold text with price
      /\*([^*]{3,50}?)(\d+[\.,]\d{2})\s*€\*/,
    ];
    
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        result.productName = match[1].trim().replace(/…/g, '...') || null;
        (result as any).estimatedValue = parseFloat(match[2].replace(',', '.'));
        (result as any).currency = 'EUR';
        console.log(`[VintedGoParser] Plain text product: "${result.productName}", price: ${(result as any).estimatedValue}`);
        return;
      }
    }
    
    // Last resort: just find any price
    const priceMatch = body.match(/(\d+[\.,]\d{2})\s*€/);
    if (priceMatch) {
      (result as any).estimatedValue = parseFloat(priceMatch[1].replace(',', '.'));
      (result as any).currency = 'EUR';
    }
  }

  /**
   * Extract product name and price from HTML email
   */
  private extractHtmlProductPrice(body: string, result: ParsedTrackingInfo): void {
    const productPricePattern = /[Dd][eé]tails?\s+de\s+la\s+commande[\s\S]{0,300}?<b>([^<]+)<br[^>]*>(\d+[\.,]\d+)\s*€<\/b>/i;
    const productPriceMatch = body.match(productPricePattern);
    if (productPriceMatch) {
      result.productName = productPriceMatch[1]?.trim().replace(/…/, '...') || null;
      (result as any).estimatedValue = parseFloat(productPriceMatch[2].replace(',', '.'));
      (result as any).currency = 'EUR';
    } else {
      const productPatterns = [
        /<b>([^<]+)<br[^>]*>\d+[\.,]\d+\s*€<\/b>/i,
        /[Dd][eé]tails?\s+de\s+la\s+commande[\s\S]{0,200}?<b>([^<]+)<br/i,
      ];
      
      for (const pattern of productPatterns) {
        const match = body.match(pattern);
        if (match && match[1]) {
          result.productName = match[1]?.trim().replace(/…/, '...') || null;
          break;
        }
      }
    }
  }

  /**
   * Extract address from plain text forwarded Vinted Go email.
   * Format: "*Relais Vinted Go*\n* Shop Name *\n* 119 Route de Brignais\n...\n*City*"
   */
  private extractPlainTextAddress(body: string): string | null {
    // Pattern: After "Adresse" section, look for address lines between asterisks
    const addrSection = body.match(/Adresse[\s\S]{0,2000}?(?=Détails de la commande|Horaires d'ouverture|Code de retrait|$)/i);
    if (!addrSection) return null;
    
    const section = addrSection[0];
    const parts: string[] = [];
    
    // Extract bold text between * markers
    const boldParts = section.matchAll(/\*\s*([^*\n]+?)\s*\*/g);
    for (const match of boldParts) {
      const text = match[1].trim();
      // Skip noise: "Relais Vinted Go", URLs, directions
      if (/^Relais Vinted Go$/i.test(text)) continue;
      if (/^https?:\/\//i.test(text)) continue;
      if (/^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)/i.test(text)) continue;
      if (text.length > 2 && text.length < 100) {
        parts.push(text);
      }
    }
    
    // Also look for lines with street patterns (not in bold)
    const streetMatch = section.match(/(\d+\s+(?:Route|Rue|Avenue|Boulevard|Place|Chemin|All[eé]e|Impasse)\s+[^\n<]+)/i);
    if (streetMatch && !parts.some(p => p.includes(streetMatch[1].trim()))) {
      parts.unshift(streetMatch[1].trim());
    }
    
    // Look for city name after Google Maps link or standalone
    const cityMatch = section.match(/(?:maps\/search\/[^\n]*\n\s*|>\s*)([A-ZÀ-Ÿ][a-zà-ÿ]+(?:-[A-ZÀ-Ÿ][a-zà-ÿ]+)*(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)\s*$/m);
    if (cityMatch && !parts.some(p => p.includes(cityMatch[1]))) {
      parts.push(cityMatch[1].trim());
    }
    
    if (parts.length >= 1) {
      const address = parts.join('\n');
      console.log(`[VintedGoParser] Plain text address: "${address.substring(0, 80)}"`);
      return address;
    }
    
    return null;
  }

  /**
   * Extract address from Vinted Go HTML email (Adresse block)
   */
  private extractVintedGoHtmlAddress(body: string): string | null {
    const vintedGoAddressMatch = body.match(/block-header[^>]*>(?:\s*)Adresse(?:\s*)<\/div>([\s\S]{0,2000}?)(?:<div[^>]*class=["']block-header|D[eé]tails de la commande|Horaires d'ouverture|Horaires d&#39;ouverture)/i);
    if (!vintedGoAddressMatch) return null;
    
    const addressHtml = vintedGoAddressMatch[1];
    const addressParts: string[] = [];
    
    const boldMatches = addressHtml.matchAll(/<b[^>]*>([\s\S]*?)<\/b>/gi);
    for (const match of boldMatches) {
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
        text.split('\n').forEach(part => {
          const cleaned = part.trim();
          if (cleaned.length > 0) {
            addressParts.push(cleaned);
          }
        });
      }
    }
    
    if (addressParts.length >= 2) {
      return addressParts.join('\n');
    }
    
    return null;
  }

  /**
   * Clean address: remove UI noise, cap length
   */
  private cleanAddress(address: string): string | null {
    if (!address) return null;
    
    // Remove UI noise text
    const noisePatterns = [
      /Voir sur la carte.*/gi,
      /Horaires d'ouverture.*/gi,
      /Horaires d&#39;ouverture.*/gi,
      /En cas d[e'].*/gi,
      /Cliquez ici.*/gi,
      /Suivre mon colis.*/gi,
      /https?:\/\/[^\s]*/gi,  // Remove URLs
      /\[image:[^\]]*\]/gi,   // Remove [image: ...] placeholders
    ];
    
    let cleaned = address;
    for (const pattern of noisePatterns) {
      cleaned = cleaned.replace(pattern, '');
    }
    
    // Normalize whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n').replace(/[ \t]+/g, ' ').trim();
    
    // Remove empty lines
    cleaned = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
    
    if (cleaned.length < 5) return null;
    if (cleaned.length > 200) {
      const postalCut = cleaned.match(/^([\s\S]{10,200}?\d{5}\s+[A-ZÀ-ÿ][A-Za-zÀ-ÿ\s-]+)/);
      if (postalCut) cleaned = postalCut[1].trim();
      else cleaned = cleaned.substring(0, 200).trim();
    }
    
    return cleaned;
  }
}
