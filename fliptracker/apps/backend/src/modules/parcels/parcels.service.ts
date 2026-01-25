import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Parcel } from '../../domain/entities';
import { IParcelRepository, PARCEL_REPOSITORY, ParcelFilters, PaginatedResult } from '../../domain/repositories';

@Injectable()
export class ParcelsService {
  constructor(
    @Inject(PARCEL_REPOSITORY)
    private repository: IParcelRepository,
  ) {}

  async findByUserId(userId: string, filters?: ParcelFilters): Promise<PaginatedResult<Parcel>> {
    return this.repository.findByUserId(userId, filters);
  }

  async findById(id: string): Promise<Parcel | null> {
    return this.repository.findById(id);
  }

  async findByTrackingNumber(userId: string, trackingNumber: string): Promise<Parcel | null> {
    return this.repository.findByTrackingNumber(userId, trackingNumber);
  }

  async create(data: Omit<Parcel, 'id' | 'createdAt' | 'updatedAt'>): Promise<Parcel> {
    return this.repository.create(data);
  }

  async update(id: string, data: Partial<Parcel>): Promise<Parcel> {
    const parcel = await this.repository.findById(id);
    if (!parcel) {
      throw new NotFoundException('Parcel not found');
    }
    return this.repository.update(id, data);
  }

  async delete(id: string): Promise<void> {
    const parcel = await this.repository.findById(id);
    if (!parcel) {
      throw new NotFoundException('Parcel not found');
    }
    await this.repository.delete(id);
  }
}
