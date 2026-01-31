export interface RawEmail {
  id: string;
  userId: string;
  provider: 'gmail' | 'outlook';
  messageId: string;
  
  subject: string;
  from: string;
  receivedAt: Date;
  rawBody: string;
  
  status: 'fetched' | 'parsed' | 'error';
  createdAt: Date;
}

export interface ParsedEmail {
  id: string;
  rawEmailId: string;
  userId: string;
  
  // Extracted tracking info
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'other';
  qrCode?: string;
  withdrawalCode?: string; // Code de retrait (pour points relais)
  articleId?: string;
  marketplace?: string;
  
  status: 'pending_shipment_lookup' | 'sent_to_carrier' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt?: Date;
}

export interface EmailSyncEvent {
  id: string;
  syncId: string;
  userId: string;
  eventType: 'SYNC_STARTED' | 'EMAILS_FETCHED' | 'EMAIL_PARSED' | 'SYNC_COMPLETED' | 'SYNC_FAILED';
  status: 'completed' | 'failed';
  
  data?: {
    totalEmails?: number;
    parsedEmails?: number;
    trackingEmails?: number;
    error?: string;
  };
  
  createdAt: Date;
}
