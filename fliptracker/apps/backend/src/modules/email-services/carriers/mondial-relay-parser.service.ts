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
export class MondialRelayParserService {
  /**
   * Validate if address is complete enough
   */
  private isAddressComplete(address: string | null): boolean {
    if (!address || address.length < 20) return false;
    if (!/\d{5}/.test(address)) return false;
    if (!/\d+\s|rue|avenue|boulevard|place|chemin|allée/i.test(address)) return false;
    return true;
  }

  /**
   * Parse Mondial Relay / Relais Colis emails
   */
  parse(email: { subject: string; body: string; from: string; receivedAt: Date }): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {
      marketplace: 'vinted',
      carrier: 'mondial_relay',
    };

    // Pattern 1: Reference like "VD3000015539" or "VINTED <number>"
    const refPatterns = [
      /VD(\d{10,})/i,
      /VINTED\s+(\d{8,})/i,
      /Référence.*?<b>([A-Z0-9]{10,})/i,
    ];

    for (const pattern of refPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.trackingNumber = match[1] || match[0];
        break;
      }
    }

    // Extract withdrawal code - typically 6 digits
    const withdrawalPatterns = [
      /Code de retrait[\s\S]*?(\d{6})/i,
      /code\s+de\s+retrait[\s:]*<[^>]*>[\s\S]*?(\d{6})/i,
      /<span[^>]*>\s*(\d{6})\s*<\/span>/i,
    ];

    for (const pattern of withdrawalPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.withdrawalCode = match[1];
        break;
      }
    }

    // Fallback: extract any 6-digit code
    if (!result.withdrawalCode) {
      const fallbackMatch = email.body.match(/(\d{6})/);
      if (fallbackMatch) {
        result.withdrawalCode = fallbackMatch[1];
      }
    }

    // Extract recipient name (usually in greeting or pickup section)
    const recipientPatterns = [
      /Bonjour\s+([A-Z][A-Z\s]+)\s*!/i,
      /Hello\s+([A-Z][A-Z\s]+)\s*!/i,
    ];

    for (const pattern of recipientPatterns) {
      const match = email.body.match(pattern);
      if (match) {
        result.recipientName = match[1]?.trim() || null;
        break;
      }
    }

    // Extract pickup address - comprehensive multi-pattern extraction
    let pickupAddress: string | null = null;
    
    // Pattern 1: Extract from table structure
    const addressTableMatch = email.body.match(/(?:adresse|address)[\s\S]{0,100}<\/td>[\s\S]{0,50}<td[^>]*>([\s\S]{1,500}?)<\/td>/i);
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
    
    // Pattern 2: Extract from <strong> tags (relay name + address)
    if (!pickupAddress || pickupAddress.length < 10) {
      const strongMatch = email.body.match(/<strong>([^<]{5,80})<\/strong>[\s\S]{0,100}?(\d+[^<]{10,120}?(?:\d{5}|LYON|PARIS|MARSEILLE|LILLE|TOULOUSE|NICE|NANTES|BORDEAUX|STRASBOURG)[^<]{0,50})/i);
      if (strongMatch) {
        pickupAddress = `${strongMatch[1].trim()}, ${strongMatch[2].trim().replace(/\s+/g, ' ')}`;
      }
    }
    
    // Pattern 3: Extract full address with postal code
    if (!pickupAddress || pickupAddress.length < 10) {
      const fullAddressMatch = email.body.match(/([A-Z][A-Z\s&\'-]+)[\s\S]{0,30}(\d+[^,<]{5,100}?\d{5}\s+[A-Z][A-Z\s-]+)/i);
      if (fullAddressMatch) {
        pickupAddress = `${fullAddressMatch[1].trim()}, ${fullAddressMatch[2].trim().replace(/\s+/g, ' ')}`;
      }
    }
    
    result.pickupAddress = pickupAddress && pickupAddress.length > 5 ? pickupAddress : null;

    // Validate address quality
    if (result.pickupAddress) {
      const isComplete = this.isAddressComplete(result.pickupAddress);
      if (!isComplete) {
        console.log(`[MondialRelayParser] ⚠️  Incomplete address extracted: ${result.pickupAddress.substring(0, 50)}...`);
      }
    }

    // Extract pickup deadline
    const deadlinePatterns = [
      /jusqu'(?:au|à)\s+(?:vendredi\s+)?(\d{1,2})\s+(?:novembre|january|january|février|mars|avril|mai|juin|juillet|août|septembre|octobre|décembre)/i,
      /available[\s\S]*?until[\s\S]*?(\d{1,2})\s+(\w+)\s+(\d{4})/i,
    ];

    for (const pattern of deadlinePatterns) {
      const match = email.body.match(pattern);
      if (match) {
        try {
          // Try to parse the date
          const dateStr = match[1];
          if (dateStr) {
            result.pickupDeadline = new Date(dateStr) || null;
          }
        } catch (e) {
          // Ignore parsing errors
        }
        break;
      }
    }

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
