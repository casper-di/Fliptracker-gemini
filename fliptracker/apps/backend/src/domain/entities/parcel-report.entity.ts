export interface ParcelReport {
  id: string;
  userId: string;
  parcelId: string;
  trackingNumber: string;
  carrier: string;
  status: string;
  reason: string;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}
