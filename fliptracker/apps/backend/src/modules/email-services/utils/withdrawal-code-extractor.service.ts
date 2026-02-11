import { Injectable } from '@nestjs/common';

@Injectable()
export class WithdrawalCodeExtractorService {
  /**
   * Extract withdrawal/pickup code with context validation.
   * Supports both HTML emails and plain text (forwarded Gmail messages with *bold* format).
   */
  extractCode(text: string, html: string): string | null {
    const strategies = [
      () => this.extractFromPlainTextBold(text),  // NEW: *CODE* format for forwarded emails
      () => this.extractFromStrongTags(html),
      () => this.extractFromContext(text),
      () => this.extractFromPatterns(text),
      () => this.extractNumericCode(text),
    ];

    for (const strategy of strategies) {
      const code = strategy();
      if (code && this.isValidCode(code)) {
        console.log(`[WithdrawalCodeExtractor] ✅ Found valid code: "${code}"`);
        return code;
      }
    }

    return null;
  }

  /**
   * Extract from plain text forwarded emails where codes are in *bold* (markdown) format.
   * Gmail forwards convert <b>CODE</b> to *CODE* in plain text.
   * Pattern: "code suivant :\n*522758*" or "le code suivant : *T17354*"
   */
  private extractFromPlainTextBold(text: string): string | null {
    const patterns = [
      // "code suivant :\n*522758*" or "code suivant : *T17354*"
      /code\s+suivant\s*:\s*\n?\*([A-Z0-9]{4,10})\*/i,
      // "votre code : *ABC123*"
      /votre\s+code\s*:\s*\n?\*([A-Z0-9]{4,10})\*/i,
      // "saisis le code suivant :\n*CODE*"
      /saisis\s+le\s+code\s+suivant\s*:\s*\n?\*([A-Z0-9]{4,10})\*/i,
      // "Code de retrait" followed eventually by *CODE*
      /code\s+de\s+retrait[\s\S]{0,200}?code\s+suivant\s*:\s*\n?\*([A-Z0-9]{4,10})\*/i,
      // Generic: any *ALPHANUMERIC* near "retrait" or "code"
      /(?:retrait|code suivant|votre code)[\s\S]{0,100}?\*([A-Z0-9]{4,10})\*/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        console.log(`[WithdrawalCodeExtractor] Found plaintext bold code: "${match[1]}"`);
        return match[1].trim();
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
      /(?:code suivant|saisis le code)[\s:]*<(?:strong|b)>([A-Z0-9]{4,10})<\/(?:strong|b)>/i,
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
   * Extract from context (near keywords) — skips HTML tags or markdown bold markers
   */
  private extractFromContext(text: string): string | null {
    const contextKeywords = [
      'code suivant',    // Most specific — check first
      'saisis le code',
      'votre code',
      'code de retrait',
      'code retrait',
      'withdrawal code',
      'pickup code',
    ];

    for (const keyword of contextKeywords) {
      const keywordPos = text.toLowerCase().indexOf(keyword.toLowerCase());
      if (keywordPos === -1) continue;

      // Skip past the keyword text itself
      const afterKeyword = text.slice(keywordPos + keyword.length, keywordPos + keyword.length + 100);
      
      // Look for alphanumeric code after the keyword, handling:
      // - HTML: <b>CODE</b>
      // - Plain text: *CODE* or just CODE
      // - With separators: : or newlines
      const codeMatch = afterKeyword.match(/[\s:]*(?:<[^>]*>)*\*?([A-Z0-9]{4,10})\*?/i);
      if (codeMatch && codeMatch[1] && this.isValidCode(codeMatch[1])) {
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
      // Handle both HTML bold and plain text *bold*
      /code[\s]*(?:de[\s]*)?(?:retrait|pickup|withdrawal|suivant)[\s:]*\*?([A-Z0-9]{4,10})\*?/i,
      /votre[\s]*code[\s:]*\*?([A-Z0-9]{4,10})\*?/i,
      /code[\s]*point[\s]*retrait[\s:]*\*?([A-Z0-9]{4,10})\*?/i,
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
    const patterns = [
      // Near "code" or "retrait" — allow *bold* markers
      /(?:code|retrait|pickup)[\s\S]{0,30}?\*?(\d{6})\*?/i,
      // Standalone 6-digit code between asterisks (Gmail bold)
      /\*(\d{6})\*/,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
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
      /^(Code|CODE|Retrait|RETRAIT|Scanne|image|badge)$/i,
      /^(Bonjour|Lundi|Samedi|Dimanche|Vendredi)$/i,
    ];

    return !noisePatterns.some(pattern => pattern.test(code));
  }
}
