import { Injectable } from '@nestjs/common';

@Injectable()
export class MarketplaceDetectorService {
  private readonly domainMap: Record<string, string> = {
    'vinted.fr': 'vinted',
    'vinted.com': 'vinted',
    'vinted.de': 'vinted',
    'vinted.es': 'vinted',
    'vinted.it': 'vinted',
    'vinted.be': 'vinted',
    'vinted.nl': 'vinted',
    'vinted.pl': 'vinted',
    'leboncoin.fr': 'leboncoin',
    'vestiairecollective.com': 'vestiaire_collective',
    'amazon.fr': 'amazon',
    'amazon.com': 'amazon',
    'amazon.de': 'amazon',
    'amazon.es': 'amazon',
    'amazon.it': 'amazon',
    'ebay.fr': 'ebay',
    'ebay.com': 'ebay',
    'ebay.de': 'ebay',
    'ebay.co.uk': 'ebay',
    'depop.com': 'depop',
    'wallapop.com': 'wallapop',
    'shopify.com': 'shopify',
    'sheinnotice.com': 'shein',
    'shein.com': 'shein',
    'orders.temu.com': 'temu',
    'temu.com': 'temu',
    'showroomprive.com': 'showroomprive',
    'cdiscount.com': 'cdiscount',
    'fnac.com': 'fnac',
    'rakuten.com': 'rakuten',
    'nespresso.com': 'nespresso',
    'redcare-pharmacie.fr': 'redcare',
  };

  private readonly bodyPatterns: Record<string, RegExp[]> = {
    vinted: [
      /\bvinted\b/i,
      /\bvintedgo\b/i,
    ],
    leboncoin: [
      /\bleboncoin\b/i,
      /\ble bon coin\b/i,
    ],
    vestiaire_collective: [
      /\bvestiaire collective\b/i,
    ],
    amazon: [
      /\bamazon\b/i,
    ],
    ebay: [
      /\bebay\b/i,
    ],
    depop: [
      /\bdepop\b/i,
    ],
    wallapop: [
      /\bwallapop\b/i,
    ],
    shein: [
      /\bshein\b/i,
    ],
    temu: [
      /\btemu\b/i,
    ],
    cdiscount: [
      /\bcdiscount\b/i,
    ],
    fnac: [
      /\bfnac\b/i,
    ],
    zalando: [
      /\bzalando\b/i,
    ],
    rakuten: [
      /\brakuten\b/i,
    ],
  };

  /**
   * Detect marketplace from email metadata
   */
  detectMarketplace(email: { from: string; subject: string; body: string }): string | null {
    // Strategy 1: Check sender domain
    const domain = this.extractDomain(email.from);
    if (domain && this.domainMap[domain]) {
      return this.domainMap[domain];
    }

    // Strategy 2: Check body patterns
    const bodyLower = email.body.toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    const combined = `${bodyLower} ${subjectLower}`;

    for (const [marketplace, patterns] of Object.entries(this.bodyPatterns)) {
      if (patterns.some(pattern => pattern.test(combined))) {
        return marketplace;
      }
    }

    // Strategy 3: Extract from "confié par X" pattern (Colissimo)
    // Stop capturing at punctuation, common verbs, or sentence boundaries
    const confieMatch = email.body.match(/confié\s+par\s+([A-Z][a-zA-Z0-9\s'-]{1,25}?)(?:\s+(?:sera|est|a\s|va|qui|pour|votre|le\s|la\s|les\s|un\s|une\s|de\s|du\s|des\s|en\s|bien|livr|expéd|envoy|dispon)|[.,;:!?\n<]|$)/i);
    if (confieMatch && confieMatch[1]) {
      const name = confieMatch[1].trim();
      if (name.length < 2) return null;
      const nameLower = name.toLowerCase();
      
      // Map common marketplace names
      if (nameLower.includes('vinted')) return 'vinted';
      if (nameLower.includes('leboncoin') || nameLower.includes('le bon coin')) return 'leboncoin';
      if (nameLower.includes('amazon')) return 'amazon';
      if (nameLower.includes('ebay')) return 'ebay';
      if (nameLower.includes('zalando')) return 'zalando';
      if (nameLower.includes('cdiscount')) return 'cdiscount';
      if (nameLower.includes('fnac')) return 'fnac';
      if (nameLower.includes('shein')) return 'shein';
      if (nameLower.includes('temu')) return 'temu';
      if (nameLower.includes('rakuten')) return 'rakuten';
      
      // Reject if it looks like a sentence fragment
      const rejectWords = ['sera', 'livr', 'bien', 'expéd', 'envoy', 'votre', 'est'];
      if (rejectWords.some(w => nameLower.includes(w))) return null;
      
      // Return cleaned marketplace name (max ~20 chars, no trailing spaces)
      return name.substring(0, 25).trim();
    }

    return null;
  }

  /**
   * Extract domain from email address
   */
  private extractDomain(email: string): string | null {
    const match = email.match(/@([a-z0-9.-]+\.[a-z]{2,})$/i);
    return match ? match[1].toLowerCase() : null;
  }
}
