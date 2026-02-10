import { Injectable } from '@nestjs/common';
import { ShipmentTypeDetectorService } from '../shipment-type-detector.service';
import { AddressExtractorService } from '../utils/address-extractor.service';
import { TrackingValidatorService } from '../utils/tracking-validator.service';
import { DateParserService } from '../utils/date-parser.service';
import { QRCodeExtractorService } from '../utils/qr-code-extractor.service';
import { MarketplaceDetectorService } from '../utils/marketplace-detector.service';
import { WithdrawalCodeExtractorService } from '../utils/withdrawal-code-extractor.service';

export interface ParsedTrackingInfo {
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other' | 'vinted_go' | 'mondial_relay' | 'chronopost';
  type?: 'purchase' | 'sale';
  qrCode?: string | null;
  withdrawalCode?: string | null;
  articleId?: string | null;
  marketplace?: string | null;
  productName?: string | null;
  productDescription?: string | null;
  recipientName?: string | null;
  senderName?: string | null;
  pickupAddress?: string | null;
  pickupDeadline?: Date | null;
}

@Injectable()
export class ChronopostParserService {
  constructor(
    private shipmentTypeDetector: ShipmentTypeDetectorService,
    private addressExtractor: AddressExtractorService,
    private trackingValidator: TrackingValidatorService,
    private dateParser: DateParserService,
    private qrCodeExtractor: QRCodeExtractorService,
    private marketplaceDetector: MarketplaceDetectorService,
    private withdrawalCodeExtractor: WithdrawalCodeExtractorService,
  ) {}

  /**
   * Normalize minified HTML by adding spaces between tags
   * Chronopost Pickup emails often have no spaces between HTML tags
   */
  private normalizeHtml(html: string): string {
    return html
      .replace(/>\s*</g, '> <')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&deg;/g, '°')
      .replace(/&#8217;/g, "'")
      .replace(/&#x20AC;/g, '€');
  }

  /**
   * Strip HTML tags to get clean text
   */
  private stripHTML(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|tr|td|h[1-6]|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&deg;/g, '°')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract Chronopost-specific withdrawal code (code sécurisé or code de retrait)
   */
  private extractChronopostWithdrawalCode(html: string): string | null {
    const normalizedHtml = this.normalizeHtml(html);
    
    // Pattern 1: "code sécurisé" followed by a 6-digit code in <span> (Chronopost MAS)
    // Example: <span style="color:#0060A2;font-size:25px">050409</span>
    const secureCodeMatch = normalizedHtml.match(/code\s+s[eé]curis[eé][\s\S]{0,200}?(\d{6})/i);
    if (secureCodeMatch) {
      console.log('[ChronopostParser] Found code sécurisé:', secureCodeMatch[1]);
      return secureCodeMatch[1];
    }

    // Pattern 2: "Code de retrait" section (Chronopost Pickup / Relais)
    // Can be minified: "Codederetrait<br/><br/><span...>692416</span>"
    const retraitCodeMatch = normalizedHtml.match(/[Cc]ode\s*(?:de\s*)?retrait[\s\S]{0,200}?(\d{4,8})/i);
    if (retraitCodeMatch) {
      console.log('[ChronopostParser] Found code de retrait:', retraitCodeMatch[1]);
      return retraitCodeMatch[1];
    }

    // Pattern 3: Minified HTML - no space between words: "Codederetrait"
    const minifiedCodeMatch = html.match(/[Cc]odederetrait[\s\S]{0,200}?(\d{4,8})/i);
    if (minifiedCodeMatch) {
      console.log('[ChronopostParser] Found minified code de retrait:', minifiedCodeMatch[1]);
      return minifiedCodeMatch[1];
    }
    
    // Pattern 4: PIN code format with styling
    const pinMatch = normalizedHtml.match(/(?:pin|code)[\s\S]{0,100}?letter-spacing[^>]*>(\d{4,8})</i);
    if (pinMatch) {
      console.log('[ChronopostParser] Found PIN code:', pinMatch[1]);
      return pinMatch[1];
    }

    return null;
  }

  /**
   * Extract Chronopost-specific pickup address
   */
  private extractChronopostAddress(html: string): string | null {
    const normalizedHtml = this.normalizeHtml(html);
    const text = this.stripHTML(normalizedHtml);

    // Strategy 1: Chronopost Pickup - "Relais Particulier chez XXX" followed by address
    // This handles both minified and normal HTML
    const relaisPattern = /(Relais\s*(?:Particulier|Pickup|Point)\s*(?:chez\s*)?[A-Za-zÀ-ÿ\s]+)\s*(\d+\s*[A-Za-zÀ-ÿ\s]+)\s*(\d{5}\s*[A-Za-zÀ-ÿ\s-]+)/i;
    const relaisMatch = text.match(relaisPattern);
    if (relaisMatch) {
      const address = [relaisMatch[1].trim(), relaisMatch[2].trim(), relaisMatch[3].trim()].join('\n');
      console.log('[ChronopostParser] Found Relais address:', address);
      return address;
    }

    // Strategy 2: Chronopost Pickup - Extract from icon-based layout
    // Look for location icon followed by address text in <td>
    const locationIconPattern = /ICO_CHR_LOCATION[\s\S]{0,500}?<td[^>]*>([^<]*(?:Relais|Point|Consigne|Bureau|Agence)[^<]*(?:<BR>|\n)[^<]*(?:<BR>|\n)[^<]*\d{5}[^<]*)<\/td>/i;
    const iconMatch = normalizedHtml.match(locationIconPattern);
    if (iconMatch) {
      const addr = iconMatch[1]
        .replace(/<BR>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .trim();
      console.log('[ChronopostParser] Found Pickup icon-based address:', addr);
      return addr;
    }

    // Strategy 3: Chronopost MAS - "Adresse de livraison" section
    // <td bgcolor="#e6e7e8"><strong>Adresse de livraison</strong></td>
    // followed by address in next <td>
    const livraisonPattern = /Adresse\s*de\s*livraison[\s\S]{0,300}?<td[^>]*>([\s\S]{10,300}?)<\/td>/i;
    const livraisonMatch = normalizedHtml.match(livraisonPattern);
    if (livraisonMatch) {
      const addr = livraisonMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      // Verify it looks like an address (has postal code)
      if (/\d{5}/.test(addr) && addr.length < 300) {
        console.log('[ChronopostParser] Found "Adresse de livraison":', addr);
        return addr;
      }
    }

    // Strategy 4: Minified Chronopost Pickup - extract text blocks with postal codes
    // In minified HTML: "17RueJacquard" becomes readable after normalizing
    const minifiedRelais = html.match(/(?:Relais|Point|Consigne|chez)\s*[A-Za-zÀ-ÿ]+[\s\S]{0,200}?\d+\s*(?:Rue|Avenue|Boulevard|Place|Allée|Chemin)[A-Za-zÀ-ÿ\s]+\d{5}\s*[A-Za-zÀ-ÿ\s-]+/i);
    if (minifiedRelais) {
      const addr = this.stripHTML(minifiedRelais[0]).trim();
      if (addr.length < 300) {
        console.log('[ChronopostParser] Found minified address:', addr);
        return addr;
      }
    }

    return null;
  }

  /**
   * Extract recipient name from Chronopost emails
   */
  private extractChronopostRecipientName(html: string): string | null {
    const normalizedHtml = this.normalizeHtml(html);
    const text = this.stripHTML(normalizedHtml);

    // Pattern 1: "Bonjour FirstName LastName" with optional punctuation
    const greetingMatch = text.match(/Bonjour\s+([A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]+){1,3})/i);
    if (greetingMatch) {
      const name = greetingMatch[1].trim();
      // Verify it's not a noise word
      if (name.length > 3 && name.length < 50 && !/votre|colis|commande/i.test(name)) {
        console.log('[ChronopostParser] Found recipient name from greeting:', name);
        return name;
      }
    }

    // Pattern 2: From "Adresse de livraison" section - name is usually first line
    const addressSectionMatch = normalizedHtml.match(/Adresse\s*de\s*livraison[\s\S]{0,300}?<td[^>]*>([^<]+)/i);
    if (addressSectionMatch) {
      const firstLine = addressSectionMatch[1].trim();
      // Check if it looks like a name (not a street)
      if (firstLine.length > 3 && firstLine.length < 50 && !/\d/.test(firstLine)) {
        console.log('[ChronopostParser] Found recipient name from address section:', firstLine);
        return firstLine;
      }
    }

    return null;
  }

  /**
   * Parse Chronopost emails
   */
  parse(email: { subject: string; body: string; from: string; receivedAt: Date }): ParsedTrackingInfo {
    console.log('[ChronopostParser] Starting parse for email with subject:', email.subject);
    
    const result: ParsedTrackingInfo = {
      marketplace: this.marketplaceDetector.detectMarketplace(email),
      carrier: 'chronopost',
      type: this.shipmentTypeDetector.detectType(email),
    };

    console.log('[ChronopostParser] Detected type:', result.type);

    // Extract QR code using robust extractor (only for incoming/pickup emails)
    if (result.type === 'purchase') {
      console.log('[ChronopostParser] Type is purchase, extracting QR code...');
      result.qrCode = this.qrCodeExtractor.extractQRCode(email.body);
      console.log('[ChronopostParser] QR code extraction result:', result.qrCode ? `Found: ${result.qrCode.substring(0, 100)}...` : 'null');
    } else {
      console.log('[ChronopostParser] Type is not purchase, skipping QR code extraction');
    }

    // Extract tracking number - Chronopost format: XW250342935TS or 3436603419
    const trackingPatterns = [
      // Pattern 1: Vinted format with or without HTML
      /Votre colis VINTED\s+n[°o]?\s*<?(?:a[^>]*>)?([A-Z]{2}\d{9,11}[A-Z]{2})/i,
      // Pattern 2: Generic with HTML tags
      /(?:colis|tracking|suivi)[^<]{0,50}<[^>]*>([A-Z]{2}\d{9,11}[A-Z]{2})/i,
      // Pattern 3: Generic with text
      /(?:numéro|numero|n°|tracking|suivi)[\s:°]*([A-Z]{2}\d{9,11}[A-Z]{2})/i,
      // Pattern 4: Standalone alphanumeric (letters+digits+letters)
      /\b([A-Z]{2}\d{9,11}[A-Z]{2})\b/,
      // Pattern 5: 10-digit tracking numbers
      /\b(\d{10})\b/,
    ];

    for (const pattern of trackingPatterns) {
      const match = email.body.match(pattern);
      if (match && match[1]) {
        const validated = this.trackingValidator.validateTracking(match[1], 'chronopost');
        if (validated) {
          result.trackingNumber = validated;
          break;
        }
      }
    }

    // Extract withdrawal code - use Chronopost-specific extractor FIRST
    result.withdrawalCode = this.extractChronopostWithdrawalCode(email.body);
    // Fallback to generic extractor
    if (!result.withdrawalCode) {
      result.withdrawalCode = this.withdrawalCodeExtractor.extractCode(email.body, email.body);
    }

    // Extract recipient name using Chronopost-specific method
    result.recipientName = this.extractChronopostRecipientName(email.body);
    
    // If still no name, try generic greeting approach
    if (!result.recipientName) {
      const greetingMatch = email.body.match(/Bonjour\s+([A-Z][a-zA-ZÀ-ÿ\s'-]+)(?:\s*[!,<&])/i);
      if (greetingMatch?.[1]) {
        const name = greetingMatch[1].trim();
        if (name.length > 3 && name.length < 50 && !/votre|colis/i.test(name)) {
          if (result.type === 'sale') {
            result.senderName = name;
          } else {
            result.recipientName = name;
          }
        }
      }
    }

    // Extract pickup address - use Chronopost-specific extractor FIRST
    result.pickupAddress = this.extractChronopostAddress(email.body);
    // Fallback to generic extractor only if Chronopost-specific didn't find anything
    if (!result.pickupAddress) {
      result.pickupAddress = this.addressExtractor.extractAddress(email.body);
    }

    // Extract pickup deadline using smart parser
    result.pickupDeadline = this.dateParser.parseDate(email.body, email.receivedAt);

    console.log('[ChronopostParser] Final result:', {
      trackingNumber: result.trackingNumber,
      type: result.type,
      withdrawalCode: result.withdrawalCode,
      recipientName: result.recipientName,
      pickupAddress: result.pickupAddress?.substring(0, 80),
      qrCode: result.qrCode ? 'found' : 'null',
    });

    return result;
  }
}
