export interface ParcelReport {
  id: string;
  userId: string;
  parcelId: string;
  trackingNumber: string;
  carrier: string;
  status: string;
  reason: string;
  sourceEmailId?: string | null;
  rawEmail?: string | null;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}
