import { Injectable } from '@nestjs/common';
import { EmailParsingService, ParsedTrackingInfo } from './email-parsing.service';
import { EmailTrackingDetectorService } from './email-tracking-detector.service';

/**
 * Smart email parsing service
 * Uses rule-based parsers with tracking validation
 * 
 * Strategy:
 * 1. Detect if email is a tracking email (regex keywords)
 * 2. Try rule-based parser (Vinted, Colissimo, etc.)
 * 3. If tracking found but incomplete data, log for DeepSeek processing later
 */
@Injectable()
export class HybridEmailParsingService {
  constructor(
    private emailParsingService: EmailParsingService,
    private trackingDetector: EmailTrackingDetectorService,
  ) {}

  async parseEmail(email: {
    subject: string;
    from: string;
    body: string;
    receivedAt?: Date;
  }): Promise<ParsedTrackingInfo & { isTrackingEmail: boolean; needsDeepSeek: boolean }> {
    console.log('[Parser] Starting email parsing...');
    
    // PHASE 1: Detect if this is a tracking email
    const isTrackingEmail = this.trackingDetector.isTrackingEmail(email);
    console.log(`[Parser] Is tracking email: ${isTrackingEmail}`);
    
    // PHASE 2: Rule-based parsing
    const result = await this.emailParsingService.parseEmail(email);
    
    // PHASE 3: Calculate completeness
    const completeness = this.calculateCompleteness(result);
    console.log(`[Parser] Completeness: ${completeness}%`);
    
    // PHASE 4: Determine if needs DeepSeek processing
    const needsDeepSeek = isTrackingEmail && completeness < 70;
    
    return {
      ...result,
      isTrackingEmail,
      needsDeepSeek,
    };
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

}
