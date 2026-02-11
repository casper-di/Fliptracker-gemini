import { Injectable } from '@nestjs/common';

@Injectable()
export class AddressExtractorService {
  /**
   * Extract complete address from HTML email body
   */
  extractAddress(html: string): string | null {
    // Try multiple strategies in order of reliability
    const strategies = [
      () => this.extractFromStructuredHTML(html),
      () => this.extractFromPatterns(html),
      () => this.extractFromContext(html),
      () => this.extractFromPostalCode(html),
    ];

    for (const strategy of strategies) {
      const address = strategy();
      if (address && this.isAddressComplete(address)) {
        return this.cleanAddress(address);
      }
    }

    return null;
  }

  /**
   * Extract from structured HTML (tables, divs with address class, etc.)
   */
  private extractFromStructuredHTML(html: string): string | null {
    // Pattern 1: ADRESSE label followed by paragraphs
    const addressSectionMatch = html.match(/ADRESSE\s*:?<\/strong>.*?<\/p>([\s\S]{20,600}?\d{5}[\s<]*[A-Za-zÀ-ÿ\s]+)/i);
    if (addressSectionMatch) {
      const section = addressSectionMatch[0];
      const lines: string[] = [];
      
      const paragraphs = section.match(/<p[^>]*>([^<]+)<\/p>/gi);
      if (paragraphs) {
        paragraphs.forEach(p => {
          const content = p.replace(/<\/?p[^>]*>/gi, '').trim();
          if (content && content !== 'ADRESSE' && !content.match(/^(\s*:|<)/) && content.length < 100) {
            lines.push(content);
          }
        });
      }
      
      if (lines.length > 0) {
        return lines.join('\n');
      }
    }

    // Pattern 2: Address block near relay/point retrait keywords in HTML
    const relayBlockPatterns = [
      // <b>NAME</b><br>ADDRESS<br>POSTAL CITY
      /(?:point\s*relais|relais\s*colis|bureau\s*de\s*poste|point\s*retrait|relais\s*pickup|relais\s*particulier)[^<]{0,30}<\/[^>]+>\s*(?:<br\s*\/?>?\s*)?<[^>]*>([^<]{3,80})<\/[^>]+>(?:\s*<br\s*\/?>?\s*(?:<[^>]*>)?([^<]{3,80})(?:<\/[^>]+>)?)?(?:\s*<br\s*\/?>?\s*(?:<[^>]*>)?([^<]{3,100})(?:<\/[^>]+>)?)?/i,
      // Table row with address after keyword
      /<t[dh][^>]*>[^<]*(?:point\s*relais|bureau\s*de\s*poste|point\s*retrait|adresse)[^<]*<\/t[dh]>\s*<t[dh][^>]*>([^<]{10,200})<\/t[dh]>/i,
    ];

    for (const pattern of relayBlockPatterns) {
      const match = html.match(pattern);
      if (match) {
        const parts = [match[1], match[2], match[3]].filter(Boolean).map(s => s.trim());
        if (parts.length > 0) {
          const combined = parts.join(', ');
          if (/\d{5}/.test(combined)) {
            return combined;
          }
        }
      }
    }

    // Pattern 3: Address in table cells with postal code
    const tableCellMatch = html.match(/<td[^>]*>[\s\S]*?(\d+[\s,]+[A-Za-zÀ-ÿ\s'-]+\d{5}[\s]*[A-Za-zÀ-ÿ\s-]+)[\s\S]*?<\/td>/i);
    if (tableCellMatch) {
      return tableCellMatch[1];
    }

    // Pattern 4: Div with address-related class/id
    const divMatch = html.match(/<div[^>]*(?:class|id)=["'][^"']*(?:address|adresse|relay|relais|pickup)[^"']*["'][^>]*>([\s\S]{20,300}?)<\/div>/i);
    if (divMatch) {
      return this.stripHTML(divMatch[1]);
    }

    return null;
  }

  /**
   * Extract using regex patterns for common address formats
   */
  private extractFromPatterns(html: string): string | null {
    const text = this.stripHTML(html);

    // Pattern 1: Number + street type + name + postal + city
    const streetFirstPatterns = [
      /(\d+[\s,]+(?:rue|avenue|boulevard|route|place|chemin|allée|impasse|passage|cours|quai|voie|square|parvis)[\s]+[A-Za-zÀ-ÿ\s'-]{3,60}[\s,]+\d{5}[\s]+[A-Za-zÀ-ÿ\s-]+)/i,
      // Relay/shop name line + postal code line
      /([A-Z][A-Za-zÀ-ÿ\s'-]{5,50}\s*[-–]\s*[A-Za-zÀ-ÿ\s'-]{3,50}\s+\d{5}\s+[A-Za-zÀ-ÿ\s-]+)/i,
    ];

    for (const pattern of streetFirstPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract from context (near keywords like "point retrait", "adresse", etc.)
   */
  private extractFromContext(html: string): string | null {
    const contextKeywords = [
      // Relay/pickup keywords
      'point relais',
      'point retrait',
      'point de retrait',
      'adresse du point',
      'lieu de retrait',
      'relais colis',
      'relais pickup',
      'relais particulier',
      // La Poste specific
      'bureau de poste',
      'votre bureau de poste',
      'agence chronopost',
      'consigne',
      // Generic pickup
      'retirez votre colis',
      'retirer votre colis',
      'disponible au',
      'disponible chez',
      'disponible dans',
      'vous attend au',
      'vous attend chez',
      'votre colis est arrivé',
      'votre colis vous attend',
      'récupérer votre colis',
      // Delivery address
      'adresse de livraison',
      'livré à',
      'livraison prévue',
      // English fallbacks
      'pickup location',
      'collection point',
      'delivery address',
    ];

    const text = this.stripHTML(html);

    for (const keyword of contextKeywords) {
      const keywordPos = text.toLowerCase().indexOf(keyword.toLowerCase());
      if (keywordPos === -1) continue;

      // Extract 400 chars after keyword (more generous window)
      const afterKeyword = text.slice(keywordPos + keyword.length, keywordPos + keyword.length + 400);
      
      // Look for postal code pattern in the extracted window
      const postalMatch = afterKeyword.match(/[\s:,]*(.{5,180}?\d{5}[\s]*[A-Za-zÀ-ÿ][\w\s-]{1,40})/);
      if (postalMatch) {
        // Clean the leading separators
        let address = postalMatch[1].replace(/^[\s:,\-–]+/, '').trim();
        // Remove if it starts with a keyword we'd want to skip
        if (address.length >= 15) {
          return address;
        }
      }
    }

    return null;
  }

  /**
   * Last-resort: find any French postal code (5 digits) and build address from surrounding text
   */
  private extractFromPostalCode(html: string): string | null {
    const text = this.stripHTML(html);
    
    // Find all 5-digit codes that look like French postal codes (start with 0-9, common prefixes)
    const postalRegex = /\b(\d{5})\b/g;
    let match: RegExpExecArray | null;
    
    while ((match = postalRegex.exec(text)) !== null) {
      const code = match[1];
      const pos = match.index;
      
      // Skip obvious non-postal codes (phone numbers, IDs, etc.)
      const codeNum = parseInt(code);
      if (codeNum < 1000 || codeNum > 98999) continue; // Valid FR postal codes: 01000-98xxx
      
      // Get 120 chars before and 60 chars after the postal code
      const before = text.slice(Math.max(0, pos - 120), pos);
      const after = text.slice(pos + 5, pos + 65);
      
      // City name is usually right after the postal code
      const cityMatch = after.match(/^\s*([A-Za-zÀ-ÿ][\w\s-]{1,40})/);
      if (!cityMatch) continue;
      
      // Look for a street/address line in the text before the postal code
      // Take the last meaningful line before the postal code
      const beforeLines = before.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 3);
      if (beforeLines.length === 0) continue;
      
      // Build address from last 1-2 lines before postal + postal + city
      const addressLines: string[] = [];
      const lastLine = beforeLines[beforeLines.length - 1];
      
      // Check if the line before looks like an address or relay name
      const hasAddressContent = /\d+\s|rue|avenue|boulevard|route|place|chemin|allée|impasse|passage|cours|quai|voie|square|parvis|zone|centre|relais|bureau|tabac|pressing|carrefour|super u|leclerc|intermarché|lidl/i.test(lastLine);
      
      if (hasAddressContent) {
        // Also check line before that for relay name
        if (beforeLines.length >= 2) {
          const prevLine = beforeLines[beforeLines.length - 2];
          if (prevLine.length >= 3 && prevLine.length <= 80 && !/[@<>]/.test(prevLine)) {
            addressLines.push(prevLine);
          }
        }
        addressLines.push(lastLine);
        addressLines.push(`${code} ${cityMatch[1].trim()}`);
        return addressLines.join(', ');
      }
    }
    
    return null;
  }

  /**
   * Check if extracted address is complete enough to be useful
   */
  isAddressComplete(address: string | null): boolean {
    if (!address || address.length < 15) return false;
    
    // Address should not be too long (indicates we captured the whole email body)
    if (address.length > 250) return false;
    
    // Must have postal code (5 digits for FR, or generic 4-6 digits)
    if (!/\d{4,6}/.test(address)) return false;
    
    // Must have at least one of: street indication, shop/relay name, or number
    const hasAddressContent = /\d+\s|rue|avenue|boulevard|place|chemin|allée|bureau|shop|relais|route|impasse|passage|résidence|lot|cours|quai|square|voie|parvis|zone|centre|tabac|pressing|agence|poste|carrefour|leclerc|intermarché/i.test(address);
    if (!hasAddressContent) return false;
    
    // Filter out legal/footer noise
    if (this.isLegalNoise(address)) return false;
    
    // Filter out UI/navigation text that got captured 
    if (this.isUIText(address)) return false;
    
    return true;
  }

  /**
   * Check if text contains legal/corporate noise
   */
  private isLegalNoise(text: string): boolean {
    const noisePatterns = [
      /RCS|SIRET|SIREN|capital de|SAS|SARL|SA\s/i,
      /mentions légales|legal notice|privacy policy|politique de confidentialité/i,
      /se désabonner|unsubscribe|opt-out/i,
      /©|copyright|all rights reserved|tous droits réservés/i,
    ];

    return noisePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if text contains UI/navigation text (buttons, links)
   */
  private isUIText(text: string): boolean {
    const uiPatterns = [
      /Voir sur la carte/i,
      /Compléter mon adresse/i,
      /Modifier la date/i,
      /Choisir un point/i,
      /vous remercie de votre confiance/i,
      /En cas d/i,
      /Cliquez ici/i,
      /Suivre mon colis/i,
    ];

    return uiPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Clean extracted address
   */
  private cleanAddress(address: string): string {
    return address
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&nbsp;/gi, ' ') // Replace HTML entities
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();
  }

  /**
   * Strip HTML tags from text
   */
  private stripHTML(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines before stripping
      .replace(/<\/(?:p|div|tr|li|h\d)>/gi, '\n') // Block elements -> newlines
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
