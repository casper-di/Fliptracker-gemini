import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../modules/auth/firebase.service';
import { ConnectedEmail } from '../../domain/entities';
import { IConnectedEmailRepository } from '../../domain/repositories';

@Injectable()
export class FirestoreConnectedEmailRepository implements IConnectedEmailRepository {
  private collection = 'connectedEmails';

  constructor(private firebaseService: FirebaseService) {}

  async findById(id: string): Promise<ConnectedEmail | null> {
    const doc = await this.firebaseService.getFirestore().collection(this.collection).doc(id).get();
    
    if (!doc.exists) {
      return null;
    }

    return this.toEntity(doc.id, doc.data()!);
  }

  async findByUserId(userId: string): Promise<ConnectedEmail[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('userId', '==', userId)
      .get();

    return snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));
  }

  async findByEmailAddress(emailAddress: string): Promise<ConnectedEmail | null> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('emailAddress', '==', emailAddress)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return this.toEntity(doc.id, doc.data());
  }

  async create(email: Omit<ConnectedEmail, 'id' | 'createdAt'>): Promise<ConnectedEmail> {
    const data = {
      ...email,
      createdAt: new Date(),
    };

    const docRef = await this.firebaseService.getFirestore().collection(this.collection).add({
      ...data,
      expiry: data.expiry,
      lastSyncAt: data.lastSyncAt,
    });

    return {
      id: docRef.id,
      ...data,
    };
  }

  async update(id: string, data: Partial<ConnectedEmail>): Promise<ConnectedEmail> {
    const updateData = { ...data };
    delete (updateData as any).id;

    await this.firebaseService.getFirestore().collection(this.collection).doc(id).update(updateData);

    const updated = await this.findById(id);
    return updated!;
  }

  async delete(id: string): Promise<void> {
    await this.firebaseService.getFirestore().collection(this.collection).doc(id).delete();
  }

  private toEntity(id: string, data: FirebaseFirestore.DocumentData): ConnectedEmail {
    return {
      id,
      userId: data.userId,
      provider: data.provider,
      emailAddress: data.emailAddress,
      refreshToken: data.refreshToken,
      accessToken: data.accessToken,
      expiry: data.expiry?.toDate() || new Date(),
      status: data.status,
      lastSyncAt: data.lastSyncAt?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  }
}
