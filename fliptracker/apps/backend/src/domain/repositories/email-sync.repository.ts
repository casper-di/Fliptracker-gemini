import { RawEmail, ParsedEmail, EmailSyncEvent } from '../entities/email-sync.entity';

export interface IRawEmailRepository {
  findById(id: string): Promise<RawEmail | null>;
  findByUserId(userId: string): Promise<RawEmail[]>;
  findByMessageId(userId: string, messageId: string): Promise<RawEmail | null>;
  create(email: Omit<RawEmail, 'id' | 'createdAt'>): Promise<RawEmail>;
  update(id: string, data: Partial<RawEmail>): Promise<RawEmail>;
  delete(id: string): Promise<void>;
}

export interface IParsedEmailRepository {
  findById(id: string): Promise<ParsedEmail | null>;
  findByUserId(userId: string): Promise<ParsedEmail[]>;
  findByTrackingNumber(userId: string, trackingNumber: string): Promise<ParsedEmail | null>;
  create(email: Omit<ParsedEmail, 'id' | 'createdAt'>): Promise<ParsedEmail>;
  update(id: string, data: Partial<ParsedEmail>): Promise<ParsedEmail>;
  delete(id: string): Promise<void>;
}

export interface IEmailSyncEventRepository {
  findById(id: string): Promise<EmailSyncEvent | null>;
  findByUserId(userId: string): Promise<EmailSyncEvent[]>;
  findBySyncId(syncId: string): Promise<EmailSyncEvent[]>;
  create(event: Omit<EmailSyncEvent, 'id' | 'createdAt'>): Promise<EmailSyncEvent>;
}

export const RAW_EMAIL_REPOSITORY = Symbol('RAW_EMAIL_REPOSITORY');
export const PARSED_EMAIL_REPOSITORY = Symbol('PARSED_EMAIL_REPOSITORY');
export const EMAIL_SYNC_EVENT_REPOSITORY = Symbol('EMAIL_SYNC_EVENT_REPOSITORY');
