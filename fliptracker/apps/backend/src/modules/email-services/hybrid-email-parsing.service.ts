import { Injectable } from '@nestjs/common';
import { NLPService } from '../nlp/nlp.service';
import { EmailParsingService, ParsedTrackingInfo } from './email-parsing.service';

/**
 * Hybrid email parsing service
 * Combines rule-based parsers (fast, deterministic) with NLP (smart, flexible)
 * 
 * Strategy:
 * 1. Try rule-based parser first (Vinted, Colissimo, etc.) - instant results
 * 2. If insufficient data extracted, use NLP to fill gaps
 * 3. NLP validates and enriches rule-based results
 */
@Injectable()
export class HybridEmailParsingService {
  constructor(
    private emailParsingService: EmailParsingService,
    private nlpService: NLPService,
  ) {}

  async parseEmail(email: {
    subject: string;
    from: string;
    body: string;
    receivedAt?: Date;
  }): Promise<ParsedTrackingInfo> {
    console.log('[HybridParser] Starting hybrid parsing...');
    
    // PHASE 1: Rule-based parsing (fast, deterministic)
    const ruleBasedResult = await this.emailParsingService.parseEmail(email);
    
    // Calculate completeness score
    const completeness = this.calculateCompleteness(ruleBasedResult);
    console.log(`[HybridParser] Rule-based completeness: ${completeness}%`);
    
    // PHASE 2: If completeness < 70%, use NLP to enhance
    if (completeness < 70) {
      console.log('[HybridParser] Completeness low, using NLP enhancement...');
      
      try {
        const nlpResult = await this.nlpService.parseEmail(email);
        const enhanced = this.mergeResults(ruleBasedResult, nlpResult);
        
        console.log(`[HybridParser] Enhanced completeness: ${this.calculateCompleteness(enhanced)}%`);
        return enhanced;
      } catch (error) {
        console.error('[HybridParser] NLP failed, using rule-based only:', error.message);
        return ruleBasedResult;
      }
    }
    
    // PHASE 3: Rule-based result is good enough
    console.log('[HybridParser] Using rule-based result (sufficient completeness)');
    return ruleBasedResult;
  }

  /**
   * Calculate how complete the extracted data is (0-100%)
   */
  private calculateCompleteness(result: ParsedTrackingInfo): number {
    let score = 0;
    let maxScore = 10;
    
    if (result.trackingNumber) score += 3; // Most important
    if (result.carrier) score += 2;
    if (result.type) score += 1;
    if (result.productName) score += 1;
    if (result.pickupAddress) score += 2; // Important for pickup
    if (result.withdrawalCode || result.qrCode) score += 1;
    
    return Math.round((score / maxScore) * 100);
  }

  /**
   * Merge rule-based and NLP results intelligently
   * Priority: Rule-based for structured data, NLP for ambiguous fields
   */
  private mergeResults(ruleBased: ParsedTrackingInfo, nlp: any): ParsedTrackingInfo {
    return {
      // Tracking: Always trust rule-based (regex is deterministic)
      trackingNumber: ruleBased.trackingNumber || nlp.tracking?.number || undefined,
      
      // Carrier: Prefer rule-based, fallback to NLP
      carrier: ruleBased.carrier || this.mapCarrier(nlp.carrier?.name),
      
      // Type: NLP is often better at detecting sale vs purchase context
      type: nlp.shipment_type || ruleBased.type,
      
      // Codes: Rule-based is usually accurate
      qrCode: ruleBased.qrCode || nlp.codes?.qr || null,
      withdrawalCode: ruleBased.withdrawalCode || nlp.codes?.withdrawal || null,
      
      // Product: NLP excels here
      productName: nlp.product?.name || ruleBased.productName || null,
      productDescription: nlp.product?.description || ruleBased.productDescription || null,
      
      // Addresses: Merge both (NLP has better parsing via libpostal)
      pickupAddress: this.selectBestAddress(ruleBased.pickupAddress, nlp.addresses) || null,
      
      // Dates: NLP can understand natural language dates better
      pickupDeadline: nlp.dates?.pickup_deadline ? new Date(nlp.dates.pickup_deadline) : ruleBased.pickupDeadline,
      estimatedDelivery: nlp.dates?.estimated_delivery ? new Date(nlp.dates.estimated_delivery) : undefined,
      
      // Sender: NLP extracts this
      senderName: nlp.sender?.name || nlp.sender?.company || ruleBased.senderName || null,
      senderEmail: nlp.sender?.email || undefined,
      
      // Recipient: Merge
      recipientName: ruleBased.recipientName || null,
      recipientEmail: undefined,
      
      // Marketplace
      marketplace: ruleBased.marketplace || null,
      
      // Order
      orderNumber: nlp.codes?.order_number || ruleBased.orderNumber || null,
      
      // Value
      estimatedValue: nlp.product?.price || ruleBased.estimatedValue || null,
      currency: nlp.product?.currency || ruleBased.currency || null,
      
      // Article
      articleId: ruleBased.articleId || null,
      
      // Destination
      destinationAddress: undefined,
    };
  }

  /**
   * Select best address from multiple sources
   */
  private selectBestAddress(ruleBasedAddr: string | null | undefined, nlpAddresses: any[]): string | null {
    if (ruleBasedAddr) return ruleBasedAddr;
    
    if (nlpAddresses && nlpAddresses.length > 0) {
      // Find address with highest confidence
      const best = nlpAddresses.sort((a, b) => b.confidence - a.confidence)[0];
      
      // Reconstruct full address
      const parts = [
        best.street,
        best.postal_code,
        best.city,
        best.country,
      ].filter(Boolean);
      
      return parts.length > 0 ? parts.join(', ') : null;
    }
    
    return null;
  }

  /**
   * Map NLP carrier name to our carrier enum
   */
  private mapCarrier(nlpCarrier: string | null): ParsedTrackingInfo['carrier'] {
    if (!nlpCarrier) return undefined;
    
    const lower = nlpCarrier.toLowerCase();
    
    if (lower.includes('vinted')) return 'vinted_go';
    if (lower.includes('mondial')) return 'mondial_relay';
    if (lower.includes('colissimo')) return 'colissimo';
    if (lower.includes('chronopost')) return 'chronopost';
    if (lower.includes('dhl')) return 'dhl';
    if (lower.includes('ups')) return 'ups';
    if (lower.includes('fedex')) return 'fedex';
    if (lower.includes('dpd')) return 'dpd';
    if (lower.includes('gls')) return 'gls';
    
    return 'other';
  }
}
