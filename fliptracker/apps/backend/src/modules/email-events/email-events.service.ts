import { Injectable, Inject } from '@nestjs/common';
import { EmailEvent } from '../../domain/entities';
import { IEmailEventRepository, EMAIL_EVENT_REPOSITORY, EmailEventFilters, EmailEventPaginatedResult } from '../../domain/repositories';

@Injectable()
export class EmailEventsService {
  constructor(
    @Inject(EMAIL_EVENT_REPOSITORY)
    private repository: IEmailEventRepository,
  ) {}

  async findByUserId(userId: string, filters?: EmailEventFilters): Promise<EmailEventPaginatedResult<EmailEvent>> {
    return this.repository.findByUserId(userId, filters);
  }

  async findById(id: string): Promise<EmailEvent | null> {
    return this.repository.findById(id);
  }

  async findByMessageId(userId: string, messageId: string): Promise<EmailEvent | null> {
    return this.repository.findByMessageId(userId, messageId);
  }

  async findPending(userId: string, limit?: number): Promise<EmailEvent[]> {
    return this.repository.findPending(userId, limit);
  }

  async recordEmailReceived(
    userId: string,
    provider: 'gmail' | 'outlook',
    messageId: string,
    subject: string,
    from: string,
    receivedAt: Date,
  ): Promise<EmailEvent> {
    return this.repository.create({
      userId,
      provider,
      messageId,
      subject,
      from,
      receivedAt,
      status: 'pending',
    });
  }

  async markProcessed(id: string, parcelId?: string): Promise<EmailEvent> {
    return this.repository.update(id, {
      status: 'processed',
      processedAt: new Date(),
      parcelId,
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<EmailEvent> {
    return this.repository.update(id, {
      status: 'failed',
      processedAt: new Date(),
      errorMessage,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
