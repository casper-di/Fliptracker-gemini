import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParsedTrackingInfo } from './email-parsing.service';

/**
 * NLP Client Service
 * 
 * HTTP client that calls the Python NLP FastAPI service for
 * CamemBERT-based entity extraction and classification.
 * 
 * This is the PRIMARY and ONLY parser for email data extraction.
 * The NLP model handles: tracking numbers, carriers, type (sale/purchase),
 * marketplace, addresses, names, codes, prices, dates, and email type.
 */

interface NlpExtractResponse {
  trackingNumbers: string[];
  pickupAddress: string | null;
  deliveryAddress: string | null;
  personNames: string[];
  withdrawalCodes: string[];
  orderNumbers: string[];
  productNames: string[];
  prices: string[];
  dates: string[];
  carrier: { label: string; confidence: number } | null;
  shipmentType: { label: string; confidence: number } | null;
  marketplace: { label: string; confidence: number } | null;
  emailType: { label: string; confidence: number } | null;
  entities: Array<{ text: string; label: string; start: number; end: number; confidence: number }>;
  processingTimeMs: number;
}

interface NlpBatchResponse {
  results: NlpExtractResponse[];
  count: number;
  totalProcessingTimeMs: number;
}

@Injectable()
export class NlpClientService {
  private readonly logger = new Logger(NlpClientService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('NLP_SERVICE_URL', 'http://localhost:8000');
    // Set timeout to 5 minutes (300,000 ms) for both single and batch requests
    this.timeout = this.configService.get<number>('NLP_SERVICE_TIMEOUT', 300000);
    this.enabled = this.configService.get<string>('NLP_SERVICE_ENABLED', 'true') === 'true';
  }

  /**
   * Check if the NLP service is enabled and available.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Health check — verify the NLP service is running.
   */
  async isHealthy(): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      const data = await response.json();
      return data.status === 'ok' && data.models_loaded === true;
    } catch {
      return false;
    }
  }

  /**
   * Extract structured data from a single email using the NLP model.
   * Returns ParsedTrackingInfo compatible with the existing pipeline.
   */
  async extractFromEmail(email: {
    body: string;
    subject: string;
    from: string;
  }): Promise<ParsedTrackingInfo | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: email.body,
          subject: email.subject,
          sender: email.from,
        }),
        signal: AbortSignal.timeout(this.timeout), // 5 minutes
      });

      if (!response.ok) {
        this.logger.warn(`NLP service returned ${response.status}`);
        return null;
      }

      const nlpResult: NlpExtractResponse = await response.json();
      return this.mapToTrackingInfo(nlpResult);
    } catch (error) {
      this.logger.warn(`NLP extraction failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Batch extract from multiple emails.
   */
  /**
   * Batch extract from multiple emails, with batching, delay, and increased timeout.
   */
  async extractBatch(emails: Array<{
    body: string;
    subject: string;
    from: string;
  }>): Promise<(ParsedTrackingInfo | null)[]> {
    if (!this.enabled || emails.length === 0) {
      return emails.map(() => null);
    }

    // Découpe en paquets de 10
    const chunkArray = <T,>(array: T[], size: number): T[][] => {
      const result: T[][] = [];
      for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
      }
      return result;
    };

    const batches = chunkArray(emails, 1);
    const allResults: (ParsedTrackingInfo | null)[] = [];

    for (const batch of batches) {
      try {
        const response = await fetch(`${this.baseUrl}/extract/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emails: batch.map(e => ({
              body: e.body,
              subject: e.subject,
              sender: e.from,
            })),
          }),
          signal: AbortSignal.timeout(6000000), // 60 secondes
        });

        if (!response.ok) {
          this.logger.warn(`NLP batch service returned ${response.status}`);
          allResults.push(...batch.map(() => null));
        } else {
          const batchResult: NlpBatchResponse = await response.json();
          this.logger.log(`NLP batch processed ${batchResult.count} emails in ${batchResult.totalProcessingTimeMs}ms`);
          allResults.push(...batchResult.results.map(r => this.mapToTrackingInfo(r)));
        }
      } catch (error) {
        this.logger.warn(`NLP batch extraction failed: ${error.message}`);
        allResults.push(...batch.map(() => null));
      }
      // Délai de 500ms entre chaque batch
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return allResults;
  }

  /**
   * Map NLP service response to ParsedTrackingInfo for pipeline compatibility.
   */
  private mapToTrackingInfo(nlp: NlpExtractResponse): ParsedTrackingInfo {
    const result: ParsedTrackingInfo = {};

    // Tracking number — take the first one
    if (nlp.trackingNumbers.length > 0) {
      result.trackingNumber = nlp.trackingNumbers[0];
    }

    // Carrier
    if (nlp.carrier && nlp.carrier.confidence > 0.3) {
      result.carrier = this.mapCarrier(nlp.carrier.label);
      result.classificationConfidence = nlp.carrier.confidence;
    }

    // Type (purchase/sale)
    if (nlp.shipmentType && nlp.shipmentType.confidence > 0.3) {
      result.type = nlp.shipmentType.label as 'purchase' | 'sale';
    }

    // Marketplace
    if (nlp.marketplace && nlp.marketplace.confidence > 0.3) {
      result.marketplace = nlp.marketplace.label;
    }

    // Email type (lifecycle classification from NLP)
    if (nlp.emailType && nlp.emailType.confidence > 0.3) {
      result.emailType = nlp.emailType.label as ParsedTrackingInfo['emailType'];
    }

    // Address
    if (nlp.pickupAddress) {
      result.pickupAddress = nlp.pickupAddress;
    }

    // Names
    if (nlp.personNames.length > 0) {
      result.recipientName = nlp.personNames[0];
    }

    // Withdrawal codes
    if (nlp.withdrawalCodes.length > 0) {
      result.withdrawalCode = nlp.withdrawalCodes[0];
    }

    // Order number
    if (nlp.orderNumbers.length > 0) {
      result.orderNumber = nlp.orderNumbers[0];
    }

    // Product
    if (nlp.productNames.length > 0) {
      result.productName = nlp.productNames[0];
    }

    // Price
    if (nlp.prices.length > 0) {
      const priceMatch = nlp.prices[0].match(/(\d+[\.,]?\d*)/);
      if (priceMatch) {
        result.estimatedValue = parseFloat(priceMatch[1].replace(',', '.'));
        // Detect currency
        const priceTxt = nlp.prices[0].toLowerCase();
        if (priceTxt.includes('€') || priceTxt.includes('eur')) {
          result.currency = 'EUR';
        } else if (priceTxt.includes('$') || priceTxt.includes('usd')) {
          result.currency = 'USD';
        }
      }
    }

    // Dates → pickupDeadline
    if (nlp.dates.length > 0) {
      const parsed = this.parseDate(nlp.dates[0]);
      if (parsed) {
        result.pickupDeadline = parsed;
      }
    }

    return result;
  }

  /**
   * Map NLP carrier label to the carrier type union.
   */
  private mapCarrier(label: string): ParsedTrackingInfo['carrier'] {
    const mapping: Record<string, ParsedTrackingInfo['carrier']> = {
      'colissimo': 'colissimo',
      'chronopost': 'chronopost',
      'mondial_relay': 'mondial_relay',
      'mondialrelay': 'mondial_relay',
      'relais_colis': 'relais_colis',
      'relaiscolis': 'relais_colis',
      'vinted_go': 'vinted_go',
      'vintedgo': 'vinted_go',
      'dhl': 'dhl',
      'ups': 'ups',
      'fedex': 'fedex',
      'dpd': 'dpd',
      'gls': 'gls',
      'colis_prive': 'colis_prive',
      'colisprive': 'colis_prive',
      'amazon_logistics': 'amazon_logistics',
      'amazon': 'amazon_logistics',
      'laposte': 'laposte',
      'other': 'other',
    };
    return mapping[label.toLowerCase()] || 'other';
  }

  /**
   * Parse a date string to a Date object.
   */
  private parseDate(dateStr: string): Date | null {
    // Try common French date formats
    const patterns: Array<{ regex: RegExp; handler: (m: RegExpMatchArray) => Date }> = [
      // DD/MM/YYYY or DD-MM-YYYY
      {
        regex: /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
        handler: (m) => new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])),
      },
      // YYYY-MM-DD
      {
        regex: /(\d{4})-(\d{2})-(\d{2})/,
        handler: (m) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])),
      },
    ];

    for (const { regex, handler } of patterns) {
      const match = dateStr.match(regex);
      if (match) {
        const date = handler(match);
        if (!isNaN(date.getTime())) return date;
      }
    }

    // Fallback: native Date parsing
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? null : fallback;
  }
}
