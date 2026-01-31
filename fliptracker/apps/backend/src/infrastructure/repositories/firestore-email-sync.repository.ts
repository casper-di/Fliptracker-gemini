import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../modules/auth/firebase.service';
import { RawEmail, ParsedEmail, EmailSyncEvent } from '../../domain/entities/email-sync.entity';
import {
  IRawEmailRepository,
  IParsedEmailRepository,
  IEmailSyncEventRepository,
} from '../../domain/repositories/email-sync.repository';

@Injectable()
export class FirestoreRawEmailRepository implements IRawEmailRepository {
  private collection = 'rawEmails';

  constructor(private firebaseService: FirebaseService) {}

  async findById(id: string): Promise<RawEmail | null> {
    const doc = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .doc(id)
      .get();
    return doc.exists ? this.toEntity(doc.id, doc.data()!) : null;
  }

  async findByUserId(userId: string): Promise<RawEmail[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));
  }

  async findByMessageId(userId: string, messageId: string): Promise<RawEmail | null> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('userId', '==', userId)
      .where('messageId', '==', messageId)
      .limit(1)
      .get();
    return snapshot.empty ? null : this.toEntity(snapshot.docs[0].id, snapshot.docs[0].data());
  }

  async create(email: Omit<RawEmail, 'id' | 'createdAt'>): Promise<RawEmail> {
    const data = { ...email, createdAt: new Date() };
    const docRef = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .add(data);
    return { id: docRef.id, ...data };
  }

  async update(id: string, data: Partial<RawEmail>): Promise<RawEmail> {
    await this.firebaseService.getFirestore().collection(this.collection).doc(id).update(data);
    const updated = await this.findById(id);
    return updated!;
  }

  async delete(id: string): Promise<void> {
    await this.firebaseService.getFirestore().collection(this.collection).doc(id).delete();
  }

  private toEntity(id: string, data: any): RawEmail {
    return {
      id,
      userId: data.userId,
      provider: data.provider,
      messageId: data.messageId,
      subject: data.subject,
      from: data.from,
      receivedAt: data.receivedAt?.toDate() || new Date(),
      rawBody: data.rawBody,
      status: data.status,
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  }
}

@Injectable()
export class FirestoreParsedEmailRepository implements IParsedEmailRepository {
  private collection = 'parsedEmails';

  constructor(private firebaseService: FirebaseService) {}

  async findById(id: string): Promise<ParsedEmail | null> {
    const doc = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .doc(id)
      .get();
    return doc.exists ? this.toEntity(doc.id, doc.data()!) : null;
  }

  async findByUserId(userId: string): Promise<ParsedEmail[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));
  }

  async findByTrackingNumber(userId: string, trackingNumber: string): Promise<ParsedEmail | null> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('userId', '==', userId)
      .where('trackingNumber', '==', trackingNumber)
      .limit(1)
      .get();
    return snapshot.empty ? null : this.toEntity(snapshot.docs[0].id, snapshot.docs[0].data());
  }

  async create(email: Omit<ParsedEmail, 'id' | 'createdAt'>): Promise<ParsedEmail> {
    const data = { ...email, createdAt: new Date(), updatedAt: new Date() };
    const docRef = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .add(data);
    return { id: docRef.id, ...data };
  }

  async update(id: string, data: Partial<ParsedEmail>): Promise<ParsedEmail> {
    const updateData = { ...data, updatedAt: new Date() };
    await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .doc(id)
      .update(updateData);
    const updated = await this.findById(id);
    return updated!;
  }

  async delete(id: string): Promise<void> {
    await this.firebaseService.getFirestore().collection(this.collection).doc(id).delete();
  }

  private toEntity(id: string, data: any): ParsedEmail {
    return {
      id,
      rawEmailId: data.rawEmailId,
      userId: data.userId,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      qrCode: data.qrCode,
      withdrawalCode: data.withdrawalCode,
      articleId: data.articleId,
      marketplace: data.marketplace,
      status: data.status,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate(),
    };
  }
}

@Injectable()
export class FirestoreEmailSyncEventRepository implements IEmailSyncEventRepository {
  private collection = 'emailSyncEvents';

  constructor(private firebaseService: FirebaseService) {}

  async findById(id: string): Promise<EmailSyncEvent | null> {
    const doc = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .doc(id)
      .get();
    return doc.exists ? this.toEntity(doc.id, doc.data()!) : null;
  }

  async findBySyncId(syncId: string): Promise<EmailSyncEvent[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('syncId', '==', syncId)
      .get();
    return snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));
  }

  async create(event: Omit<EmailSyncEvent, 'id' | 'createdAt'>): Promise<EmailSyncEvent> {
    const data = { ...event, createdAt: new Date() };
    const docRef = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .add(data);
    return { id: docRef.id, ...data };
  }

  private toEntity(id: string, data: any): EmailSyncEvent {
    return {
      id,
      syncId: data.syncId,
      userId: data.userId,
      eventType: data.eventType,
      status: data.status,
      data: data.data,
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  }
}
