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
  };

  private readonly bodyPatterns: Record<string, RegExp[]> = {
    vinted: [
      /vinted/i,
      /vintedgo/i,
    ],
    leboncoin: [
      /leboncoin/i,
      /le bon coin/i,
    ],
    vestiaire_collective: [
      /vestiaire collective/i,
      /vestiaire/i,
    ],
    amazon: [
      /amazon/i,
      /prime/i,
    ],
    ebay: [
      /ebay/i,
      /paypal/i,
    ],
    depop: [
      /depop/i,
    ],
    wallapop: [
      /wallapop/i,
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
    const confieMatch = email.body.match(/confié\s+par\s+([A-Z][a-zA-Z0-9\s]{2,30})/i);
    if (confieMatch && confieMatch[1]) {
      const name = confieMatch[1].trim().toLowerCase();
      
      // Map common marketplace names
      if (name.includes('vinted')) return 'vinted';
      if (name.includes('leboncoin') || name.includes('le bon coin')) return 'leboncoin';
      if (name.includes('amazon')) return 'amazon';
      if (name.includes('ebay')) return 'ebay';
      
      // Return as-is if not in known list
      return confieMatch[1].trim();
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
