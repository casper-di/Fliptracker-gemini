export type ParcelStatus = 'pending' | 'in_transit' | 'delivered' | 'returned' | 'unknown';
export type ParcelType = 'sale' | 'purchase';
export type Carrier = 'ups' | 'fedex' | 'laposte' | 'dhl' | 'usps' | 'colissimo' | 'chronopost' | 'vinted_go' | 'mondial_relay' | 'other';

export interface Parcel {
  id: string;
  userId: string;
  trackingNumber: string;
  carrier: Carrier;
  status: ParcelStatus;
  type: ParcelType;
  sourceEmailId: string;
  provider: string; // 'gmail', 'outlook', etc
  title: string;
  price?: number;
  currency?: string;
  
  // Enhanced metadata from emails
  productName?: string | null; // "Nike Air Force 1"
  productDescription?: string | null; // Size, condition, etc
  recipientName?: string | null; // Who receives it
  recipientEmail?: string | null; // Recipient email
  senderName?: string | null; // Who sent it
  senderEmail?: string | null; // Original email sender
  pickupAddress?: string | null; // Point relais address
  destinationAddress?: string | null; // Delivery address
  pickupDeadline?: Date | null; // Deadline to pickup
  estimatedDelivery?: Date | null; // Estimated delivery date
  orderNumber?: string | null; // Transaction reference
  withdrawalCode?: string | null; // Code for point relais
  qrCode?: string | null; // QR code for pickup
  marketplace?: string | null; // Vinted, Leboncoin, etc
  itemPrice?: number | null; // Item price from email
  
  createdAt: Date;
  updatedAt: Date;
}
