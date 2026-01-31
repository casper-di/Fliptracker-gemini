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
  provider: 'gmail' | 'outlook';
  title: string;
  price?: number;
  currency?: string;
  createdAt: Date;
  updatedAt: Date;
}
