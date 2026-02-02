import { Injectable } from '@nestjs/common';
import { getFirestore } from 'firebase-admin/firestore';
import { UnparsedEmail } from '../../domain/entities/unparsed-email.entity';
import { IUnparsedEmailRepository } from '../../domain/repositories/unparsed-email.repository';

@Injectable()
export class FirestoreUnparsedEmailRepository implements IUnparsedEmailRepository {
  private db = getFirestore();
  private collection = 'unparsedEmails';

  async create(data: Omit<UnparsedEmail, 'id' | 'createdAt' | 'updatedAt'>): Promise<UnparsedEmail> {
    const docRef = this.db.collection(this.collection).doc();
    
    const now = new Date();
    const email: UnparsedEmail = {
      ...data,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set({
      ...email,
      receivedAt: email.receivedAt?.toISOString(),
      processedAt: email.processedAt?.toISOString(),
      deepseekProcessedAt: email.deepseekProcessedAt?.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return email;
  }

  async findPendingByUserId(userId: string, limit: number = 50): Promise<UnparsedEmail[]> {
    const snapshot = await this.db
      .collection(this.collection)
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => this.mapToEntity(doc.data()));
  }

  async findById(id: string): Promise<UnparsedEmail | null> {
    const doc = await this.db.collection(this.collection).doc(id).get();
    return doc.exists ? this.mapToEntity(doc.data()!) : null;
  }

  async updateStatus(
    id: string,
    status: UnparsedEmail['status'],
    errorMessage?: string,
  ): Promise<UnparsedEmail> {
    const docRef = this.db.collection(this.collection).doc(id);
    const updates: any = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    if (status === 'processing' || status === 'processed' || status === 'failed') {
      updates.processedAt = new Date().toISOString();
    }

    await docRef.update(updates);
    const updated = await docRef.get();
    return this.mapToEntity(updated.data()!);
  }

  async markProcessed(id: string): Promise<UnparsedEmail> {
    const docRef = this.db.collection(this.collection).doc(id);
    await docRef.update({
      status: 'processed',
      deepseekProcessedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const updated = await docRef.get();
    return this.mapToEntity(updated.data()!);
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(this.collection).doc(id).delete();
  }

  private mapToEntity(data: any): UnparsedEmail {
    return {
      id: data.id,
      userId: data.userId,
      messageId: data.messageId,
      provider: data.provider,
      subject: data.subject,
      from: data.from,
      body: data.body,
      receivedAt: new Date(data.receivedAt),
      trackingNumber: data.trackingNumber ?? null,
      carrier: data.carrier ?? null,
      status: data.status,
      processedAt: data.processedAt ? new Date(data.processedAt) : undefined,
      deepseekProcessedAt: data.deepseekProcessedAt ? new Date(data.deepseekProcessedAt) : undefined,
      errorMessage: data.errorMessage,
      completenessScore: data.completenessScore,
      isTrackingEmail: data.isTrackingEmail,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }
}
