import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ConnectedEmail, EmailProvider } from '../../domain/entities';
import { IConnectedEmailRepository, CONNECTED_EMAIL_REPOSITORY } from '../../domain/repositories';
import { EncryptionService } from '../../infrastructure/services/encryption.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ConnectedEmailsService {
  constructor(
    @Inject(CONNECTED_EMAIL_REPOSITORY)
    private repository: IConnectedEmailRepository,
    private encryptionService: EncryptionService,
    private usersService: UsersService,
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
    console.log('[ConnectedEmailsService] Connecting email:', { userId, provider, emailAddress });
    const encryptedRefreshToken = this.encryptionService.encrypt(refreshToken);

    try {
      const result = await this.repository.create({
        userId,
        provider,
        emailAddress,
        accessToken,
        refreshToken: encryptedRefreshToken,
        expiry,
        status: 'active',
        lastSyncAt: null,
      });
      await this.updateUserProviderFlag(userId, provider, true);
      console.log('[ConnectedEmailsService] Email connected successfully:', result.id);
      return result;
    } catch (error) {
      console.error('[ConnectedEmailsService] Failed to connect email:', error);
      throw error;
    }
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
    const remaining = await this.repository.findByUserId(email.userId);
    const stillConnected = remaining.some(item => item.provider === email.provider);
    await this.updateUserProviderFlag(email.userId, email.provider, stillConnected);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  getDecryptedRefreshToken(email: ConnectedEmail): string {
    return this.encryptionService.decrypt(email.refreshToken);
  }

  private async updateUserProviderFlag(
    userId: string,
    provider: EmailProvider,
    isConnected: boolean,
  ): Promise<void> {
    const update: Record<string, boolean> = {};
    if (provider === 'gmail') {
      update.gmailConnected = isConnected;
    } else if (provider === 'outlook') {
      update.outlookConnected = isConnected;
    }

    try {
      await this.usersService.update(userId, update);
    } catch (error) {
      console.warn('[ConnectedEmailsService] Failed to update user provider flag:', {
        userId,
        provider,
        isConnected,
        error: error?.message || error,
      });
    }
  }
}
