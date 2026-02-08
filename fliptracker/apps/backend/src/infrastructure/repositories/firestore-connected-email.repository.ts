import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../modules/auth/firebase.service';
import { ConnectedEmail } from '../../domain/entities';
import { IConnectedEmailRepository } from '../../domain/repositories';

@Injectable()
export class FirestoreConnectedEmailRepository implements IConnectedEmailRepository {
  private collection = 'connectedEmails';

  constructor(private firebaseService: FirebaseService) {}

  async findAll(): Promise<ConnectedEmail[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));
  }

  async findById(id: string): Promise<ConnectedEmail | null> {
    const doc = await this.firebaseService.getFirestore().collection(this.collection).doc(id).get();
    
    if (!doc.exists) {
      return null;
    }

    return this.toEntity(doc.id, doc.data()!);
  }

  async findByUserId(userId: string): Promise<ConnectedEmail[]> {
    console.log('[FirestoreConnectedEmailRepository] Finding emails for userId:', userId);
    try {
      const snapshot = await this.firebaseService
        .getFirestore()
        .collection(this.collection)
        .where('userId', '==', userId)
        .get();

      console.log('[FirestoreConnectedEmailRepository] Found', snapshot.docs.length, 'email(s)');
      return snapshot.docs.map(doc => this.toEntity(doc.id, doc.data()));
    } catch (error) {
      console.error('[FirestoreConnectedEmailRepository] Failed to query emails:', {
        error: error.message,
        code: error.code,
      });
      throw error;
    }
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

  async findByEmailAddressAndProvider(
    emailAddress: string,
    provider: ConnectedEmail['provider'],
  ): Promise<ConnectedEmail | null> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('emailAddress', '==', emailAddress)
      .where('provider', '==', provider)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return this.toEntity(doc.id, doc.data());
  }

  async findByOutlookSubscriptionId(subscriptionId: string): Promise<ConnectedEmail | null> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('provider', '==', 'outlook')
      .where('outlookSubscriptionId', '==', subscriptionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return this.toEntity(doc.id, doc.data());
  }

  async create(email: Omit<ConnectedEmail, 'id' | 'createdAt'>): Promise<ConnectedEmail> {
    console.log('[FirestoreConnectedEmailRepository] Creating email connection:', {
      userId: email.userId,
      provider: email.provider,
      emailAddress: email.emailAddress,
    });

    const data = {
      ...email,
      createdAt: new Date(),
    };

    try {
      const docRef = await this.firebaseService.getFirestore().collection(this.collection).add({
        ...data,
        expiry: data.expiry,
        lastSyncAt: data.lastSyncAt,
      });

      console.log('[FirestoreConnectedEmailRepository] Successfully created document with ID:', docRef.id);

      return {
        id: docRef.id,
        ...data,
      };
    } catch (error) {
      console.error('[FirestoreConnectedEmailRepository] Failed to create email connection:', {
        error: error.message,
        code: error.code,
        stack: error.stack,
      });
      throw error;
    }
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
      initialSyncCompleted: data.initialSyncCompleted,
      initialSyncCompletedAt: data.initialSyncCompletedAt?.toDate() || undefined,
      gmailHistoryId: data.gmailHistoryId,
      gmailWatchExpiration: data.gmailWatchExpiration?.toDate() || undefined,
      outlookSubscriptionId: data.outlookSubscriptionId,
      outlookSubscriptionExpiresAt: data.outlookSubscriptionExpiresAt?.toDate() || undefined,
      outlookClientState: data.outlookClientState,
    };
  }
}
