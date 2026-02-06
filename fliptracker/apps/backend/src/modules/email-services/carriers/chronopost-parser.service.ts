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
  senderName?: string | null;
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

    // Extract QR code URL (only for incoming/pickup emails - type='purchase')
    // Outgoing/deposit emails don't have QR codes, avoid tracking pixels
    if (result.type === 'purchase') {
      const qrPatterns = [
        /src=["']([^"']*qr[^"']*)["']/i,
        /alt=["'].*qr.*["'][^>]*src=["']([^"']+)["']/i,
        /src=["'](https?:\/\/[^"']*\/qr[^"']*)["']/i,
        /src=["'](data:image\/[^;]+;base64,[^"\']{50,})["']/i,
      ];

      for (const pattern of qrPatterns) {
        const match = email.body.match(pattern);
        if (match && match[1]) {
          // Verify it's not a tracking pixel (width="1" height="1")
          const imgTagPattern = new RegExp(`<img[^>]*src=["']${match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
          const imgTagMatch = email.body.match(imgTagPattern);
          if (imgTagMatch && !/width=["']1["']|height=["']1["']/.test(imgTagMatch[0])) {
            result.qrCode = match[1];
            console.log(`[ChronopostParser] ✅ Found QR code: ${result.qrCode.substring(0, 100)}...`);
            break;
          }
        }
      }

      // Fallback: search for any image URL in QR code context (skip tracking pixels)
      if (!result.qrCode) {
        const contextMatch = email.body.match(/qr[\s\S]{0,200}?<img[^>]*src=["']([^"']+)["']/i);
        if (contextMatch && contextMatch[1]) {
          const imgTagPattern = new RegExp(`<img[^>]*src=["']${contextMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
          const imgTagMatch = email.body.match(imgTagPattern);
          if (imgTagMatch && !/width=["']1["']|height=["']1["']/.test(imgTagMatch[0])) {
            result.qrCode = contextMatch[1];
            console.log(`[ChronopostParser] ✅ Found QR code (context): ${result.qrCode.substring(0, 100)}...`);
          }
        }
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

    // Extract withdrawal code - typically 6 digits (only for pickup emails)
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

    // Extract recipient/sender name from greeting
    // For outgoing emails (type=sale): extract sender name
    // For incoming emails (type=purchase): extract recipient name
    const greetingMatch = email.body.match(/Bonjour\s+([A-Z][a-zA-Z\s'-]+)(?:\s*!|\s*<)/i);
    if (greetingMatch && greetingMatch[1]) {
      const name = greetingMatch[1].trim();
      if (result.type === 'sale') {
        // Outgoing email: the greeted person is the sender
        result.senderName = name;
        console.log(`[ChronopostParser] ✅ Extracted sender name (outgoing): ${name}`);
      } else {
        // Incoming email: the greeted person is the recipient
        result.recipientName = name;
        console.log(`[ChronopostParser] ✅ Extracted recipient name (incoming): ${name}`);
      }
    }

    // Extract pickup address - comprehensive patterns
    let pickupAddress: string | null = null;
    
    // Pattern 1: Chronopost Pickup HTML structure with <BR> tags (e.g., "Relais Particulier chez Tallone<BR>17 Rue...")
    const pickupBRMatch = email.body.match(/<td[^>]*>\s*([^<]+)<BR>\s*([^<]+)<BR>\s*([^<]+)<BR>/i);
    if (pickupBRMatch) {
      const line1 = pickupBRMatch[1].trim();
      const line2 = pickupBRMatch[2].trim();
      const line3 = pickupBRMatch[3].trim();
      // Vérifier que c'est une vraie adresse (pas le footer)
      if (line3.match(/\d{5}/) && !line1.includes('capital') && !line1.includes('RCS')) {
        pickupAddress = `${line1}\n${line2}\n${line3}`;
      }
    }
    
    // Pattern 2: "Votre relais Pickup" section with strong tag
    if (!pickupAddress) {
      const pickupMatch = email.body.match(/Votre relais Pickup[\s\S]{0,200}<strong>([^<]{5,80})<\/strong>[\s\S]{0,100}?(\d+[^<]{10,150}?(?:\d{5}|[A-Z]{2,20}))/i);
      if (pickupMatch) {
        pickupAddress = `${pickupMatch[1].trim()}, ${pickupMatch[2].trim().replace(/\s+/g, ' ')}`;
      }
    }
    
    // Pattern 3: Extract from table structure
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
    
    result.pickupAddress = pickupAddress && pickupAddress.length > 5 ? pickupAddress : null;

    // Validate address quality
    if (result.pickupAddress) {
      const isComplete = this.isAddressComplete(result.pickupAddress);
      if (!isComplete) {
        console.log(`[ChronopostParser] ⚠️  Incomplete address extracted: ${result.pickupAddress.substring(0, 50)}...`);
      }
    }

    // Extract pickup deadline
    const monthMap: Record<string, string> = {
      'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03',
      'avril': '04', 'mai': '05', 'juin': '06', 'juillet': '07',
      'août': '08', 'aout': '08', 'septembre': '09', 'octobre': '10',
      'novembre': '11', 'décembre': '12', 'decembre': '12',
    };

    // Pattern 1: "jusqu'au <strong>jour DD mois YYYY</strong>" (Chronopost Pickup format)
    const deadlineStrongMatch = email.body.match(/jusqu[''']au\s*<strong>\s*\w+\s+(\d{1,2})\s+(\w+)\s+(\d{4})\s*<\/strong>/i);
    if (deadlineStrongMatch) {
      try {
        const day = deadlineStrongMatch[1].padStart(2, '0');
        const monthName = deadlineStrongMatch[2].toLowerCase();
        const year = deadlineStrongMatch[3];
        const month = monthMap[monthName];
        if (month) {
          result.pickupDeadline = new Date(`${year}-${month}-${day}`);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Pattern 2: Fallback without strong tag
    if (!result.pickupDeadline) {
      const deadlineMatch = email.body.match(/jusqu[''']au\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
      if (deadlineMatch) {
        try {
          const day = deadlineMatch[1].padStart(2, '0');
          const monthName = deadlineMatch[2].toLowerCase();
          const year = deadlineMatch[3];
          const month = monthMap[monthName];
          if (month) {
            result.pickupDeadline = new Date(`${year}-${month}-${day}`);
          }
        } catch (e) {
          // Ignore parsing errors
        }
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
