import { Parcel, ParcelStatus, ParcelType } from '../entities/parcel.entity';

export interface ParcelFilters {
  type?: ParcelType;
  status?: ParcelStatus;
  provider?: 'gmail' | 'outlook';
  startDate?: Date;
  endDate?: Date;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface IParcelRepository {
  findById(id: string): Promise<Parcel | null>;
  findByUserId(userId: string, filters?: ParcelFilters): Promise<PaginatedResult<Parcel>>;
  findByTrackingNumber(userId: string, trackingNumber: string): Promise<Parcel | null>;
  create(parcel: Omit<Parcel, 'id' | 'createdAt' | 'updatedAt'>): Promise<Parcel>;
  update(id: string, data: Partial<Parcel>): Promise<Parcel>;
  delete(id: string): Promise<void>;
}

export const PARCEL_REPOSITORY = Symbol('PARCEL_REPOSITORY');
