import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../modules/auth/firebase.service';
import { EmailEvent } from '../../domain/entities';
import { IEmailEventRepository, EMAIL_EVENT_REPOSITORY, EmailEventFilters, EmailEventPaginatedResult } from '../../domain/repositories';

@Injectable()
export class FirestoreEmailEventRepository implements IEmailEventRepository {
  private collection = 'emailEvents';

  constructor(private firebaseService: FirebaseService) {}

  async findById(id: string): Promise<EmailEvent | null> {
    const doc = await this.firebaseService.getFirestore().collection(this.collection).doc(id).get();
    
    if (!doc.exists) {
      return null;
    }

    return this.toEntity(doc.id, doc.data()!);
  }

  async findByUserId(userId: string, filters?: EmailEventFilters): Promise<EmailEventPaginatedResult<EmailEvent>> {
    let query: FirebaseFirestore.Query = this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('userId', '==', userId);

    if (filters?.provider) {
      query = query.where('provider', '==', filters.provider);
    }
    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }
    if (filters?.startDate) {
      query = query.where('receivedAt', '>=', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.where('receivedAt', '<=', filters.endDate);
    }

    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;

    query = query.orderBy('receivedAt', 'desc');

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    query = query.limit(limit).offset(offset);

    const snapshot = await query.get();
    const events = snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));

    return {
      data: events,
      total,
      limit,
      offset,
    };
  }

  async findByMessageId(userId: string, messageId: string): Promise<EmailEvent | null> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('userId', '==', userId)
      .where('messageId', '==', messageId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return this.toEntity(doc.id, doc.data());
  }

  async findPending(userId: string, limit: number = 100): Promise<EmailEvent[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .orderBy('receivedAt', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));
  }

  async create(event: Omit<EmailEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailEvent> {
    const now = new Date();
    const data = {
      ...event,
      status: event.status || 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await this.firebaseService.getFirestore().collection(this.collection).add(data);

    return {
      id: docRef.id,
      ...data,
    } as EmailEvent;
  }

  async update(id: string, data: Partial<EmailEvent>): Promise<EmailEvent> {
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

  private toEntity(id: string, data: FirebaseFirestore.DocumentData): EmailEvent {
    return {
      id,
      userId: data.userId,
      provider: data.provider,
      messageId: data.messageId,
      parcelId: data.parcelId,
      subject: data.subject,
      from: data.from,
      receivedAt: data.receivedAt?.toDate() || new Date(),
      processedAt: data.processedAt?.toDate() || undefined,
      status: data.status,
      errorMessage: data.errorMessage,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
}
