import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../modules/auth/firebase.service';
import { User } from '../../domain/entities';
import { IUserRepository } from '../../domain/repositories';

@Injectable()
export class FirestoreUserRepository implements IUserRepository {
  private collection = 'users';

  constructor(private firebaseService: FirebaseService) {}

  async findById(id: string): Promise<User | null> {
    const doc = await this.firebaseService.getFirestore().collection(this.collection).doc(id).get();
    
    if (!doc.exists) {
      return null;
    }

    return this.toEntity(doc.id, doc.data()!);
  }

  async findByEmail(email: string): Promise<User | null> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collection)
      .where('email', '==', email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return this.toEntity(doc.id, doc.data());
  }

  async create(user: Omit<User, 'createdAt'>): Promise<User> {
    const data = {
      email: user.email,
      provider: user.provider,
      createdAt: new Date(),
    };

    await this.firebaseService.getFirestore().collection(this.collection).doc(user.id).set(data);

    return {
      id: user.id,
      ...data,
    };
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const updateData = { ...data };
    delete (updateData as any).id;

    await this.firebaseService.getFirestore().collection(this.collection).doc(id).update(updateData);

    const updated = await this.findById(id);
    return updated!;
  }

  async delete(id: string): Promise<void> {
    await this.firebaseService.getFirestore().collection(this.collection).doc(id).delete();
  }

  private toEntity(id: string, data: FirebaseFirestore.DocumentData): User {
    return {
      id,
      email: data.email,
      provider: data.provider,
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  }
}
