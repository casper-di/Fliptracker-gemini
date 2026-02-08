import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParsedTrackingInfo } from './email-parsing.service';
import puter from '@heyputer/puter.js';

export interface DeepSeekEmailInput {
  id: string;
  subject: string;
  from: string;
  body: string;
  receivedAt?: Date | null;
  partial: ParsedTrackingInfo;
}

@Injectable()
export class DeepSeekService {
  private readonly defaultBatchSize = 8;
  private readonly defaultMaxChars = 12000;
  private readonly defaultModel = 'deepseek/deepseek-v3.2-speciale';

  constructor(private configService: ConfigService) {}

  async enhanceEmails(inputs: DeepSeekEmailInput[]): Promise<Record<string, ParsedTrackingInfo>> {
    if (inputs.length === 0) return {};

    const enabled = this.configService.get<string>('DEEPSEEK_ENABLED') !== 'false';
    if (!enabled) {
      console.warn('[DeepSeekService] DEEPSEEK_ENABLED is false - skipping enhancement');
      return {};
    }

    const batchSize = Number(this.configService.get<string>('DEEPSEEK_BATCH_SIZE')) || this.defaultBatchSize;
    const maxChars = Number(this.configService.get<string>('DEEPSEEK_MAX_CHARS')) || this.defaultMaxChars;

    const results: Record<string, ParsedTrackingInfo> = {};
    for (const batch of this.chunkInputs(inputs, batchSize, maxChars)) {
      const prompt = this.buildPrompt(batch);
      const responseText = await this.callDeepSeek(prompt);
      const parsed = this.parseResponse(responseText);
      for (const item of parsed) {
        if (item?.emailId) {
          results[item.emailId] = this.cleanParsedResult(item);
        }
      }
    }

    return results;
  }

  private chunkInputs(inputs: DeepSeekEmailInput[], batchSize: number, maxChars: number): DeepSeekEmailInput[][] {
    const batches: DeepSeekEmailInput[][] = [];
    let current: DeepSeekEmailInput[] = [];
    let currentChars = 0;

    for (const input of inputs) {
      const clippedBody = input.body.slice(0, 8000);
      const serializedLength = input.subject.length + input.from.length + clippedBody.length;

      const willOverflow = current.length >= batchSize || currentChars + serializedLength > maxChars;
      if (willOverflow && current.length > 0) {
        batches.push(current);
        current = [];
        currentChars = 0;
      }

      current.push({ ...input, body: clippedBody });
      currentChars += serializedLength;
    }

    if (current.length > 0) {
      batches.push(current);
    }

    return batches;
  }

  private buildPrompt(inputs: DeepSeekEmailInput[]): string {
    const allowedCarriers = [
      'dhl',
      'ups',
      'fedex',
      'laposte',
      'colissimo',
      'vinted_go',
      'mondial_relay',
      'chronopost',
      'dpd',
      'colis_prive',
      'gls',
      'amazon_logistics',
      'other',
    ];

    const payload = inputs.map(input => ({
      emailId: input.id,
      subject: input.subject,
      from: input.from,
      body: input.body,
      receivedAt: input.receivedAt ? input.receivedAt.toISOString() : null,
      partial: input.partial,
    }));

    return [
      'You are an email parsing engine. Extract shipment tracking details.',
      'Return ONLY valid JSON (no markdown).',
      'Output format: {"results":[{...}]}',
      'Each result must include: emailId, trackingNumber, carrier, type, qrCode, withdrawalCode, articleId, marketplace, productName, productDescription, recipientName, senderName, pickupAddress, pickupDeadline, orderNumber, estimatedValue, currency.',
      'Use null if unknown. carrier must be one of: ' + allowedCarriers.join(', ') + '.',
      'type must be purchase or sale when possible.',
      'marketplace should be detected from email content (vinted, leboncoin, vestiaire_collective, ebay, amazon, etc). Look for mentions in subject, sender, or body.',
      'pickupDeadline must be ISO 8601 date string or null.',
      'estimatedValue must be a number (no currency symbol).',
      'pickupAddress must be the COMPLETE address including: relay/shop name, street number, street name, postal code, city.',
      'Extract full addresses, not just partial info.',
      'qrCode: Extract QR code IMAGE URL from HTML. Look for: <img src="..." alt="qr"> or src attribute containing "qr". Return the full URL or base64 data URI.',
      'withdrawalCode: Extract withdrawal/pickup code (typically 4-10 alphanumeric characters).',
      'Input JSON:',
      JSON.stringify(payload),
    ].join('\n');
  }

  private async callDeepSeek(prompt: string): Promise<string> {
    const model = this.configService.get<string>('DEEPSEEK_MODEL') || this.defaultModel;

    try {
      const response: any = await puter.ai.chat(prompt, {
        model,
        stream: false,
      } as any);

      // Debug logging to see actual response structure
      console.log('[DeepSeekService] Response type:', typeof response);
      console.log('[DeepSeekService] Response keys:', response ? Object.keys(response) : 'null');
      console.log('[DeepSeekService] Full response:', JSON.stringify(response).substring(0, 500));
      
      // Try multiple paths to extract content
      let content = '';
      if (typeof response === 'string') {
        content = response;
      } else if (response?.message?.content) {
        content = response.message.content.toString();
      } else if (response?.content) {
        content = response.content.toString();
      } else if (response?.choices?.[0]?.message?.content) {
        content = response.choices[0].message.content;
      } else if (response?.text) {
        content = response.text.toString();
      }

      console.log('[DeepSeekService] Extracted content length:', content.length);
      console.log('[DeepSeekService] Content preview:', content.substring(0, 200));

      return content || '';
    } catch (error) {
      console.error('[DeepSeekService] Puter.js error:', error);
      throw new Error(`[DeepSeekService] Puter.js error: ${error.message}`);
    }
  }

  private parseResponse(text: string): Array<Record<string, any>> {
    const cleaned = text
      .replace(/^```json\n?/i, '')
      .replace(/^```\n?/i, '')
      .replace(/```$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.results)) return parsed.results;
      return [];
    } catch (error) {
      console.warn('[DeepSeekService] Failed to parse JSON response:', error);
      console.warn('[DeepSeekService] Raw response (first 500 chars):', text.substring(0, 500));
      console.warn('[DeepSeekService] Cleaned response (first 500 chars):', cleaned.substring(0, 500));
      return [];
    }
  }

  private cleanParsedResult(result: Record<string, any>): ParsedTrackingInfo & { emailId?: string } {
    // Build result object only with non-undefined values
    const cleaned: any = {};

    // Only add fields if they have actual values (not null or undefined)
    if (result.trackingNumber) cleaned.trackingNumber = result.trackingNumber;
    if (result.carrier) cleaned.carrier = result.carrier;
    if (result.type) cleaned.type = result.type;
    
    // For nullable fields, explicitly set to null if missing
    cleaned.qrCode = result.qrCode ?? null;
    cleaned.withdrawalCode = result.withdrawalCode ?? null;
    cleaned.articleId = result.articleId ?? null;
    cleaned.marketplace = result.marketplace ?? null;
    cleaned.productName = result.productName ?? null;
    cleaned.productDescription = result.productDescription ?? null;
    cleaned.recipientName = result.recipientName ?? null;
    cleaned.senderName = result.senderName ?? null;
    cleaned.pickupAddress = result.pickupAddress ?? null;
    cleaned.pickupDeadline = result.pickupDeadline ? new Date(result.pickupDeadline) : null;
    cleaned.orderNumber = result.orderNumber ?? null;
    cleaned.estimatedValue = typeof result.estimatedValue === 'number' ? result.estimatedValue : null;
    cleaned.currency = result.currency ?? null;

    return cleaned;
  }
}
