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

    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    if (filters?.search) {
      const snapshot = await query.get();
      const parcels = snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));
      const searchLower = filters.search.toLowerCase();
      const filtered = parcels.filter(p => {
        const fields = [
          p.title,
          p.productName,
          p.trackingNumber,
          p.carrier,
          p.senderName,
          p.senderEmail,
          p.recipientName,
          p.recipientEmail,
          p.marketplace,
          p.orderNumber,
        ].filter(Boolean) as string[];
        return fields.some(value => value.toLowerCase().includes(searchLower));
      });

      return {
        data: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
      };
    }

    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;

    query = query.limit(limit).offset(offset);

    const snapshot = await query.get();
    const parcels = snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));

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
      // Email parsing metadata
      senderName: data.senderName || null,
      senderEmail: data.senderEmail || null,
      recipientName: data.recipientName || null,
      recipientEmail: data.recipientEmail || null,
      productName: data.productName || null,
      productDescription: data.productDescription || null,
      orderNumber: data.orderNumber || null,
      pickupAddress: data.pickupAddress || null,
      pickupDeadline: data.pickupDeadline?.toDate() || null,
      destinationAddress: data.destinationAddress || null,
      estimatedDelivery: data.estimatedDelivery?.toDate() || null,
      qrCode: data.qrCode || null,
      withdrawalCode: data.withdrawalCode || null,
      marketplace: data.marketplace || null,
      itemPrice: data.itemPrice || null,
    };
  }
}
