
export enum ShipmentStatus {
  ORDERED = 'ORDERED',
  LABEL_CREATED = 'LABEL_CREATED',
  PICKED_UP = 'PICKED_UP',
  SHIPPED = 'SHIPPED',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  PICKUP_AVAILABLE = 'PICKUP_AVAILABLE',
  DELIVERED = 'DELIVERED',
  DELAYED = 'DELAYED',
  CANCELLED = 'CANCELLED',
  RETURN_INITIATED = 'RETURN_INITIATED',
  RETURNED_TO_SENDER = 'RETURNED_TO_SENDER'
}

export enum ShipmentDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND'
}

export interface Milestone {
  id: string;
  status: ShipmentStatus;
  location?: string;
  timestamp: string;
  description: string;
}

export interface PickupInfo {
  locationName?: string;
  address?: string;
  pickupDate?: string;
  deadlineDate?: string;
  pickupCode?: string;
}

export interface Shipment {
  id: string;
  userId: string;
  trackingNumber: string;
  carrier: string;
  sender: string; 
  recipient: string;
  direction: ShipmentDirection;
  status: ShipmentStatus;
  estimatedDelivery?: string;
  history: Milestone[];
  lastUpdated: string;
  sourceEmailId?: string;
  sourceEmailUrl?: string;
  orderUrl?: string;
  platformName?: string;
  pickupInfo?: PickupInfo;
  destinationAddress?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'urgent' | 'success';
  shipmentId?: string;
  read: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  displayMode: 'compact' | 'comfortable';
  notifications: {
    pushEnabled: boolean;
    pickupReminders: boolean;
    imminentReturnAlerts: boolean;
    newShipmentDetected: boolean;
    deliveryToday: boolean;
  };
  sync: {
    autoScan: boolean;
    weeklyRescan: boolean;
    includeSpams: boolean;
    restrictedSenders: boolean;
  };
}

export interface ConnectedEmail {
  id: string;
  userId: string;
  provider: 'gmail' | 'outlook';
  emailAddress: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry: string;
  scopes: string[];
  status: 'connected' | 'expired' | 'error';
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncStatus {
  connections: ConnectedEmail[];
  isLoading: boolean;
  error: string | null;
}

export type TabType = 'incoming' | 'outgoing' | 'history' | 'notifications' | 'settings' | 'add' | 'email_sync';
