export interface EmailEvent {
  id: string;
  userId: string;
  provider: 'gmail' | 'outlook';
  messageId: string;
  parcelId?: string; // Reference to parcel created from this email
  subject: string;
  from: string;
  receivedAt: Date;
  processedAt?: Date;
  status: 'pending' | 'processed' | 'failed';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
