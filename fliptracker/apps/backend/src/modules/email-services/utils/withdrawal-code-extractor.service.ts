import { Injectable } from '@nestjs/common';

@Injectable()
export class WithdrawalCodeExtractorService {
  /**
   * Extract withdrawal/pickup code with context validation
   */
  extractCode(text: string, html: string): string | null {
    const strategies = [
      () => this.extractFromStrongTags(html),
      () => this.extractFromContext(text),
      () => this.extractFromPatterns(text),
      () => this.extractNumericCode(text),
    ];

    for (const strategy of strategies) {
      const code = strategy();
      if (code && this.isValidCode(code)) {
        return code;
      }
    }

    return null;
  }

  /**
   * Extract from <strong> or <b> tags near "code" keyword
   */
  private extractFromStrongTags(html: string): string | null {
    const patterns = [
      /code\s+(?:de\s+)?(?:retrait|pickup|withdrawal)[\s:]*<(?:strong|b)>([A-Z0-9]+)<\/(?:strong|b)>/i,
      /<(?:strong|b)>([A-Z0-9]{4,10})<\/(?:strong|b)>[\s]*(?:code|retrait|pickup)/i,
      // Pattern for Vinted Go: "saisis le code suivant : <b>CODE</b>"
      /(?:code suivant|saisis le code)[\s:]*<(?:strong|b)>([A-Z0-9]{4,10})<\/(?:strong|b)>/i,
      // Pattern for any bold code after colon
      /:\s*<(?:strong|b)>([A-Z0-9]{4,10})<\/(?:strong|b)>/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract from context (near keywords)
   */
  private extractFromContext(text: string): string | null {
    const contextKeywords = [
      'code de retrait',
      'code retrait',
      'withdrawal code',
      'pickup code',
      'code suivant',
      'votre code',
      'saisis le code',
    ];

    for (const keyword of contextKeywords) {
      const keywordPos = text.toLowerCase().indexOf(keyword.toLowerCase());
      if (keywordPos === -1) continue;

      // Extract 100 chars after keyword to account for HTML tags
      const context = text.slice(keywordPos, keywordPos + 100);
      
      // Look for alphanumeric code (4-10 chars), skipping HTML tags
      const codeMatch = context.match(/[:\s]*(?:<[^>]*>)*([A-Z0-9]{4,10})(?:<\/[^>]*>)*/i);
      if (codeMatch && codeMatch[1]) {
        return codeMatch[1];
      }
    }

    return null;
  }

  /**
   * Extract using common patterns
   */
  private extractFromPatterns(text: string): string | null {
    const patterns = [
      /code[\s]*(?:de[\s]*)?(?:retrait|pickup|withdrawal|suivant)[\s:]*([A-Z0-9]{4,10})/gi,
      /votre[\s]*code[\s:]*([A-Z0-9]{4,10})/gi,
      /code[\s]*point[\s]*retrait[\s:]*([A-Z0-9]{4,10})/gi,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const code = match[1].trim();
        if (this.isValidCode(code)) {
          return code;
        }
      }
    }

    return null;
  }

  /**
   * Extract standalone numeric codes (6 digits for Mondial Relay, etc.)
   */
  private extractNumericCode(text: string): string | null {
    // Look for 6-digit codes near "code" or "retrait"
    const numericPattern = /(?:code|retrait|pickup)[\s\S]{0,30}?(\d{6})/i;
    const match = text.match(numericPattern);
    if (match && match[1]) {
      return match[1];
    }

    return null;
  }

  /**
   * Validate if extracted code looks legitimate
   */
  private isValidCode(code: string): boolean {
    if (!code || code.length < 4 || code.length > 10) return false;

    // Must be alphanumeric
    if (!/^[A-Z0-9]+$/i.test(code)) return false;

    // Filter out common noise patterns
    const noisePatterns = [
      /^(HTTP|HTTPS|WWW|HTML|UTF|ISO|RGB)$/i,
      /^(TRUE|FALSE|NULL|NONE)$/i,
      /^(PIXEL|IMAGE|STYLE|CLASS)$/i,
    ];

    return !noisePatterns.some(pattern => pattern.test(code));
  }
}
