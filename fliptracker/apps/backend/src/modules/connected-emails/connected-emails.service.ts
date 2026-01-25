import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ConnectedEmail, EmailProvider } from '../../domain/entities';
import { IConnectedEmailRepository, CONNECTED_EMAIL_REPOSITORY } from '../../domain/repositories';
import { EncryptionService } from '../../infrastructure/services/encryption.service';

@Injectable()
export class ConnectedEmailsService {
  constructor(
    @Inject(CONNECTED_EMAIL_REPOSITORY)
    private repository: IConnectedEmailRepository,
    private encryptionService: EncryptionService,
  ) {}

  async findByUserId(userId: string): Promise<ConnectedEmail[]> {
    return this.repository.findByUserId(userId);
  }

  async findById(id: string): Promise<ConnectedEmail | null> {
    return this.repository.findById(id);
  }

  async connect(
    userId: string,
    provider: EmailProvider,
    emailAddress: string,
    accessToken: string,
    refreshToken: string,
    expiry: Date,
  ): Promise<ConnectedEmail> {
    const encryptedRefreshToken = this.encryptionService.encrypt(refreshToken);

    return this.repository.create({
      userId,
      provider,
      emailAddress,
      accessToken,
      refreshToken: encryptedRefreshToken,
      expiry,
      status: 'active',
      lastSyncAt: null,
    });
  }

  async updateTokens(
    id: string,
    accessToken: string,
    refreshToken: string,
    expiry: Date,
  ): Promise<ConnectedEmail> {
    const encryptedRefreshToken = this.encryptionService.encrypt(refreshToken);
    
    return this.repository.update(id, {
      accessToken,
      refreshToken: encryptedRefreshToken,
      expiry,
      status: 'active',
    });
  }

  async updateSyncTime(id: string): Promise<ConnectedEmail> {
    return this.repository.update(id, {
      lastSyncAt: new Date(),
    });
  }

  async disconnect(id: string): Promise<void> {
    const email = await this.repository.findById(id);
    if (!email) {
      throw new NotFoundException('Connected email not found');
    }
    await this.repository.delete(id);
  }

  getDecryptedRefreshToken(email: ConnectedEmail): string {
    return this.encryptionService.decrypt(email.refreshToken);
  }
}
