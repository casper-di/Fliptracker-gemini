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
  carrier?: 'dhl' | 'ups' | 'fedex' | 'laposte' | 'colissimo' | 'vinted_go' | 'mondial_relay' | 'chronopost' | 'dpd' | 'colis_prive' | 'gls' | 'amazon_logistics' | 'relais_colis' | 'other';
  qrCode?: string | null;
  withdrawalCode?: string | null;
  
  // Email classification (NEW)
  emailType?: 'order_confirmed' | 'label_created' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'pickup_ready' | 'returned' | 'info' | 'promo' | 'unknown';
  sourceType?: 'platform' | 'carrier' | 'unknown';  // Who sent the email
  sourceName?: string | null;                         // e.g. 'vinted', 'colissimo'
  classificationConfidence?: number | null;            // 0-1
  labelUrl?: string | null;                            // PDF/label download link
  
  // Email metadata
  provider?: string | null;
  senderEmail?: string | null;
  senderName?: string | null;
  receivedAt?: Date | null;
  
  // Shipment details
  marketplace?: string | null;
  type?: 'purchase' | 'sale';
  articleId?: string | null;
  productName?: string | null;
  productDescription?: string | null;
  
  // Recipient/Delivery
  recipientName?: string | null;
  pickupAddress?: string | null;
  pickupDeadline?: Date | null;
  
  // Order/Transaction
  orderNumber?: string | null;
  estimatedValue?: number | null;
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
