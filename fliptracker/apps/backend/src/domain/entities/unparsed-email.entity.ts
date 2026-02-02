/**
 * Unparsed Email Entity
 * Emails that need DeepSeek processing because regex couldn't fully parse them
 */
export interface UnparsedEmail {
  id: string;
  userId: string;
  messageId: string;
  provider: 'gmail' | 'outlook';
  
  // Email content
  subject: string;
  from: string;
  body: string;
  receivedAt: Date;
  
  // Partial parsing results
  trackingNumber?: string | null; // Found by regex but incomplete data
  carrier?: string | null;
  
  // Processing status
  status: 'pending' | 'processing' | 'processed' | 'failed';
  processedAt?: Date;
  deepseekProcessedAt?: Date;
  errorMessage?: string;
  
  // Metadata
  completenessScore: number; // 0-100%
  isTrackingEmail: boolean;
  createdAt: Date;
  updatedAt: Date;
}
