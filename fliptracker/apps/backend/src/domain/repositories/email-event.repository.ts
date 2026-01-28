import { EmailEvent } from '../entities';

export const EMAIL_EVENT_REPOSITORY = 'EMAIL_EVENT_REPOSITORY';

export interface EmailEventFilters {
  provider?: 'gmail' | 'outlook';
  status?: 'pending' | 'processed' | 'failed';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface EmailEventPaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface IEmailEventRepository {
  findById(id: string): Promise<EmailEvent | null>;
  findByUserId(userId: string, filters?: EmailEventFilters): Promise<EmailEventPaginatedResult<EmailEvent>>;
  findByMessageId(userId: string, messageId: string): Promise<EmailEvent | null>;
  findPending(userId: string, limit?: number): Promise<EmailEvent[]>;
  create(event: Omit<EmailEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailEvent>;
  update(id: string, data: Partial<EmailEvent>): Promise<EmailEvent>;
  delete(id: string): Promise<void>;
}
