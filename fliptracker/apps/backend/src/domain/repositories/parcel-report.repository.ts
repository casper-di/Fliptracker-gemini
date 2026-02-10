import { ParcelReport } from '../entities';

export const PARCEL_REPORT_REPOSITORY = Symbol('PARCEL_REPORT_REPOSITORY');

export interface IParcelReportRepository {
  create(data: Omit<ParcelReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<ParcelReport>;
  findByParcelId(parcelId: string): Promise<ParcelReport[]>;
  findByUserId(userId: string): Promise<ParcelReport[]>;
  findAllUnresolved(): Promise<ParcelReport[]>;
  resolve(id: string): Promise<ParcelReport>;
}
