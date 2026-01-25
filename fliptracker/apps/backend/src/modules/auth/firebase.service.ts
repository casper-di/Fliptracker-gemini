import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app: admin.app.App;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('Firebase credentials not configured. Auth will not work.');
      return;
    }

    this.app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  async verifyToken(token: string): Promise<admin.auth.DecodedIdToken | null> {
    try {
      return await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  getFirestore(): admin.firestore.Firestore {
    return admin.firestore();
  }
}
