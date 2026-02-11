export type ParcelStatus = 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned' | 'unknown';
export type ParcelType = 'sale' | 'purchase';
export type Carrier = 'ups' | 'fedex' | 'laposte' | 'dhl' | 'usps' | 'colissimo' | 'chronopost' | 'vinted_go' | 'mondial_relay' | 'relais_colis' | 'dpd' | 'gls' | 'colis_prive' | 'amazon_logistics' | 'other';

// Email classification types
export type EmailType = 
  | 'order_confirmed'    // Commande confirmée
  | 'label_created'      // Étiquette créée
  | 'shipped'            // Expédié
  | 'in_transit'         // En transit
  | 'out_for_delivery'   // En cours de livraison
  | 'delivered'          // Livré
  | 'pickup_ready'       // Prêt au point relais
  | 'returned'           // Retourné
  | 'info'              // Info générale (non-actionable)
  | 'promo'             // Promo/newsletter (à ignorer)
  | 'unknown';           // Non classifié

export type SourceType = 'platform' | 'carrier' | 'unknown';

export interface StatusHistoryEntry {
  status: ParcelStatus;
  timestamp: Date;
  emailType?: EmailType;
  sourceEmailId?: string;
}

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
  
  // Email classification
  lastEmailType?: EmailType | null;
  sourceType?: SourceType | null;       // platform (Vinted) vs carrier (Colissimo)
  sourceName?: string | null;           // 'vinted', 'colissimo', etc.
  
  // Enhanced metadata from emails
  productName?: string | null;
  productDescription?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  pickupAddress?: string | null;
  destinationAddress?: string | null;
  pickupDeadline?: Date | null;
  estimatedDelivery?: Date | null;
  orderNumber?: string | null;
  withdrawalCode?: string | null;
  qrCode?: string | null;
  marketplace?: string | null;
  itemPrice?: number | null;
  labelUrl?: string | null;             // Lien vers le bordereau/étiquette PDF
  
  // Status tracking
  statusHistory?: StatusHistoryEntry[];

  // Issue reporting
  reported?: boolean;
  reportedAt?: Date | null;
  reportReason?: string | null;
  
  createdAt: Date;
  updatedAt: Date;
}
