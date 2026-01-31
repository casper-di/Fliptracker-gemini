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
  
  // Tracking information
  trackingNumber?: string;
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'vinted_go' | 'mondial_relay' | 'chronopost' | 'other';
  qrCode?: string | null;
  withdrawalCode?: string | null;
  
  // Email metadata
  provider?: string | null; // 'gmail', 'outlook', etc (from RawEmail provider)
  senderEmail?: string | null; // Original sender email address
  senderName?: string | null; // 'Vinted', 'Mondial Relay', 'Amazon', etc
  receivedAt?: Date | null; // When email was received
  
  // Shipment details
  marketplace?: string | null; // 'vinted', 'amazon', 'ebay', etc
  articleId?: string | null;
  productName?: string | null; // e.g., "Nike Air Force 1 - Black"
  productDescription?: string | null; // e.g., "Size 40, excellent condition"
  
  // Recipient/Delivery
  recipientName?: string | null; // Who receives the parcel
  pickupAddress?: string | null; // Parcel point address
  pickupDeadline?: Date | null; // When to pick it up
  
  // Order/Transaction
  orderNumber?: string | null; // Internal reference
  estimatedValue?: number | null; // Price if available
  currency?: string | null;
  
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
