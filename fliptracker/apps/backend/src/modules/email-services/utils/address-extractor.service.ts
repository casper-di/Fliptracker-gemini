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

    // Pattern 2: Address in table cells
    const tableCellMatch = html.match(/<td[^>]*>[\s\S]*?(\d+[\s,]+[A-Za-zÀ-ÿ\s]+\d{5}[\s]*[A-Za-zÀ-ÿ\s]+)[\s\S]*?<\/td>/i);
    if (tableCellMatch) {
      return tableCellMatch[1];
    }

    // Pattern 3: Div with address-related class/id
    const divMatch = html.match(/<div[^>]*(?:class|id)=["'][^"']*address[^"']*["'][^>]*>([\s\S]{20,300}?)<\/div>/i);
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

    // French address pattern: street, postal code, city
    const frenchPattern = /([A-Za-zÀ-ÿ\s]+(?: - )?\d+[\s,]+[A-Za-zÀ-ÿ\s]+\d{5}[\s]+[A-Za-zÀ-ÿ\s]+)/;
    const match = text.match(frenchPattern);
    if (match) {
      return match[1];
    }

    return null;
  }

  /**
   * Extract from context (near keywords like "point retrait", "adresse", etc.)
   */
  private extractFromContext(html: string): string | null {
    const contextKeywords = [
      'point retrait',
      'adresse du point',
      'retirez votre colis',
      'lieu de retrait',
      'pickup location',
      'collection point',
    ];

    const text = this.stripHTML(html);

    for (const keyword of contextKeywords) {
      const keywordPos = text.toLowerCase().indexOf(keyword.toLowerCase());
      if (keywordPos === -1) continue;

      // Extract 300 chars after keyword
      const context = text.slice(keywordPos, keywordPos + 300);
      
      // Look for postal code pattern
      const postalMatch = context.match(/(.{10,200}?\d{5}[\s]*[A-Za-zÀ-ÿ]+)/);
      if (postalMatch) {
        return postalMatch[1].trim();
      }
    }

    return null;
  }

  /**
   * Check if extracted address is complete
   */
  private isAddressComplete(address: string | null): boolean {
    if (!address || address.length < 20) return false;
    
    // Must have postal code (5 digits for FR, or generic 4-6 digits)
    if (!/\d{4,6}/.test(address)) return false;
    
    // Must have street indication or shop name
    const hasStreetInfo = /\d+\s|rue|avenue|boulevard|place|chemin|allée|bureau|shop|relais/i.test(address);
    if (!hasStreetInfo) return false;
    
    // Filter out legal/footer noise
    if (this.isLegalNoise(address)) return false;
    
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
   * Clean extracted address
   */
  private cleanAddress(address: string): string {
    return address
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\r?\n/g, '\n') // Normalize line breaks
      .trim();
  }

  /**
   * Strip HTML tags from text
   */
  private stripHTML(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
