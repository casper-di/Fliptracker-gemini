import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../modules/auth/firebase.service';
import { Parcel } from '../../domain/entities';
import { IParcelRepository, ParcelFilters, PaginatedResult } from '../../domain/repositories';

@Injectable()
export class FirestoreParcelRepository implements IParcelRepository {
  private collection = 'parcels';

  constructor(private firebaseService: FirebaseService) {}

  async findById(id: string): Promise<Parcel | null> {
    const doc = await this.firebaseService.getFirestore().collection(this.collection).doc(id).get();
    
    if (!doc.exists) {
      return null;
    }

    return this.toEntity(doc.id, doc.data()!);
  }

  async findByUserId(userId: string, filters?: ParcelFilters): Promise<PaginatedResult<Parcel>> {
    let query: FirebaseFirestore.Query = this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('userId', '==', userId);

    if (filters?.type) {
      query = query.where('type', '==', filters.type);
    }
    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }
    if (filters?.provider) {
      query = query.where('provider', '==', filters.provider);
    }
    if (filters?.startDate) {
      query = query.where('createdAt', '>=', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.where('createdAt', '<=', filters.endDate);
    }

    const sortBy = filters?.sortBy || 'createdAt';
    const sortOrder = filters?.sortOrder || 'desc';
    query = query.orderBy(sortBy, sortOrder);

    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;

    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;
    
    query = query.limit(limit).offset(offset);

    const snapshot = await query.get();
    let parcels = snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      parcels = parcels.filter(
        p =>
          p.title.toLowerCase().includes(searchLower) ||
          p.trackingNumber.toLowerCase().includes(searchLower),
      );
    }

    return {
      data: parcels,
      total,
      limit,
      offset,
    };
  }

  async findByTrackingNumber(userId: string, trackingNumber: string): Promise<Parcel | null> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('userId', '==', userId)
      .where('trackingNumber', '==', trackingNumber)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return this.toEntity(doc.id, doc.data());
  }

  async create(parcel: Omit<Parcel, 'id' | 'createdAt' | 'updatedAt'>): Promise<Parcel> {
    const now = new Date();
    const data = {
      ...parcel,
      status: parcel.status || 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await this.firebaseService.getFirestore().collection(this.collection).add(data);

    return {
      id: docRef.id,
      ...data,
    } as Parcel;
  }

  async update(id: string, data: Partial<Parcel>): Promise<Parcel> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };
    delete (updateData as any).id;

    await this.firebaseService.getFirestore().collection(this.collection).doc(id).update(updateData);

    const updated = await this.findById(id);
    return updated!;
  }

  async delete(id: string): Promise<void> {
    await this.firebaseService.getFirestore().collection(this.collection).doc(id).delete();
  }

  private toEntity(id: string, data: FirebaseFirestore.DocumentData): Parcel {
    return {
      id,
      userId: data.userId,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      status: data.status,
      type: data.type,
      sourceEmailId: data.sourceEmailId,
      provider: data.provider,
      title: data.title,
      price: data.price,
      currency: data.currency,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
}
