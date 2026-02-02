import { UnparsedEmail } from '../entities/unparsed-email.entity';

export const UNPARSED_EMAIL_REPOSITORY = 'UNPARSED_EMAIL_REPOSITORY';

export interface IUnparsedEmailRepository {
  /**
   * Create a new unparsed email record
   */
  create(data: Omit<UnparsedEmail, 'id' | 'createdAt' | 'updatedAt'>): Promise<UnparsedEmail>;
  
  /**
   * Find all pending unparsed emails for a user
   */
  findPendingByUserId(userId: string, limit?: number): Promise<UnparsedEmail[]>;
  
  /**
   * Find by ID
   */
  findById(id: string): Promise<UnparsedEmail | null>;
  
  /**
   * Update status
   */
  updateStatus(id: string, status: UnparsedEmail['status'], errorMessage?: string): Promise<UnparsedEmail>;
  
  /**
   * Mark as processed by DeepSeek
   */
  markProcessed(id: string): Promise<UnparsedEmail>;
  
  /**
   * Delete
   */
  delete(id: string): Promise<void>;
}
