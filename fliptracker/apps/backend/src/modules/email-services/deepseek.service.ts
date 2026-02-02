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
      'pickupDeadline must be ISO 8601 date string or null.',
      'estimatedValue must be a number (no currency symbol).',
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

      // response est un ChatResponse avec { message?: ChatMessage }
      return response?.message?.content?.toString() || '';
    } catch (error) {
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
      return [];
    }
  }

  private cleanParsedResult(result: Record<string, any>): ParsedTrackingInfo & { emailId?: string } {
    return {
      trackingNumber: result.trackingNumber ?? undefined,
      carrier: result.carrier ?? undefined,
      type: result.type ?? undefined,
      qrCode: result.qrCode ?? null,
      withdrawalCode: result.withdrawalCode ?? null,
      articleId: result.articleId ?? null,
      marketplace: result.marketplace ?? null,
      productName: result.productName ?? null,
      productDescription: result.productDescription ?? null,
      recipientName: result.recipientName ?? null,
      senderName: result.senderName ?? null,
      pickupAddress: result.pickupAddress ?? null,
      pickupDeadline: result.pickupDeadline ? new Date(result.pickupDeadline) : null,
      orderNumber: result.orderNumber ?? null,
      estimatedValue: typeof result.estimatedValue === 'number' ? result.estimatedValue : null,
      currency: result.currency ?? null,
    };
  }
}
