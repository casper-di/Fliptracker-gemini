import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../modules/auth/firebase.service';
import { ParcelReport } from '../../domain/entities';
import { IParcelReportRepository } from '../../domain/repositories';

@Injectable()
export class FirestoreParcelReportRepository implements IParcelReportRepository {
  private collection = 'parcel_reports';

  constructor(private firebaseService: FirebaseService) {}

  async create(data: Omit<ParcelReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<ParcelReport> {
    const now = new Date();
    const docData = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await this.firebaseService.getFirestore().collection(this.collection).add(docData);
    return { id: docRef.id, ...docData };
  }

  async findByParcelId(parcelId: string): Promise<ParcelReport[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('parcelId', '==', parcelId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));
  }

  async findByUserId(userId: string): Promise<ParcelReport[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));
  }

  async findAllUnresolved(): Promise<ParcelReport[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('resolved', '==', false)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));
  }

  async resolve(id: string): Promise<ParcelReport> {
    const docRef = this.firebaseService.getFirestore().collection(this.collection).doc(id);
    await docRef.update({ resolved: true, updatedAt: new Date() });
    const doc = await docRef.get();
    return this.toEntity(doc.id, doc.data()!);
  }

  private toEntity(id: string, data: FirebaseFirestore.DocumentData): ParcelReport {
    return {
      id,
      userId: data.userId,
      parcelId: data.parcelId,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      status: data.status,
      reason: data.reason,
      resolved: data.resolved ?? false,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
    };
  }
}
