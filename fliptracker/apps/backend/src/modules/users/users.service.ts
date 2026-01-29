import { Injectable, Inject } from '@nestjs/common';
import { User } from '../../domain/entities';
import { IUserRepository, USER_REPOSITORY } from '../../domain/repositories';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private userRepository: IUserRepository,
  ) {}

  async findOrCreate(
    uid: string,
    email: string,
    provider: 'google' | 'microsoft' | 'email',
    emailVerified?: boolean,
    externalProviderId?: string,  // e.g., 'sub' from Google, 'oid' from Microsoft
  ): Promise<User> {
    let user = await this.userRepository.findById(uid);
    
    if (!user) {
      const authFlags: Partial<User> = {
        googleOAuthEnabled: provider === 'google',
        outlookOAuthEnabled: provider === 'microsoft',
        passwordAuthEnabled: provider === 'email',
        lastAuthAt: new Date(),
      };

      if (provider === 'google') {
        authFlags.lastGoogleAuthAt = new Date();
      } else if (provider === 'microsoft') {
        authFlags.lastOutlookAuthAt = new Date();
      } else if (provider === 'email') {
        authFlags.lastPasswordAuthAt = new Date();
      }

      const providerIds: Record<string, string> = {};
      if (externalProviderId && provider !== 'email') {
        providerIds[provider] = externalProviderId;
      }

      user = await this.userRepository.create({
        id: uid,
        email,
        provider,
        emailVerified,
        providerIds: Object.keys(providerIds).length > 0 ? providerIds : undefined,
        ...authFlags,
      });
    } else if (emailVerified !== undefined && user.emailVerified !== emailVerified) {
      user = await this.userRepository.update(uid, { emailVerified });
    }

    // Update last auth timestamp and provider ID
    await this.trackAuthMethod(uid, provider, externalProviderId);

    return user;
  }

  private async trackAuthMethod(
    uid: string,
    provider: 'google' | 'microsoft' | 'email',
    externalProviderId?: string,
  ): Promise<void> {
    const update: Partial<User> = {
      lastAuthAt: new Date(),
    };

    if (provider === 'google') {
      update.googleOAuthEnabled = true;
      update.lastGoogleAuthAt = new Date();
      if (externalProviderId) {
        update.providerIds = { ...((await this.userRepository.findById(uid))?.providerIds || {}), google: externalProviderId };
      }
    } else if (provider === 'microsoft') {
      update.outlookOAuthEnabled = true;
      update.lastOutlookAuthAt = new Date();
      if (externalProviderId) {
        update.providerIds = { ...((await this.userRepository.findById(uid))?.providerIds || {}), microsoft: externalProviderId };
      }
    } else if (provider === 'email') {
      update.passwordAuthEnabled = true;
      update.lastPasswordAuthAt = new Date();
    }

    try {
      await this.userRepository.update(uid, update);
    } catch (error) {
      console.warn('[UsersService] Failed to track auth method:', { uid, provider, error: error?.message });
    }
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return this.userRepository.update(id, data);
  }

  async delete(id: string): Promise<void> {
    return this.userRepository.delete(id);
  }
}
