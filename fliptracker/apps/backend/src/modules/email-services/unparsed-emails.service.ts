import { Injectable, Inject } from '@nestjs/common';
import { UnparsedEmail } from '../../domain/entities/unparsed-email.entity';
import { IUnparsedEmailRepository, UNPARSED_EMAIL_REPOSITORY } from '../../domain/repositories/unparsed-email.repository';

@Injectable()
export class UnparsedEmailsService {
  constructor(
    @Inject(UNPARSED_EMAIL_REPOSITORY)
    private repository: IUnparsedEmailRepository,
  ) {}

  async logUnparsedEmail(data: {
    userId: string;
    messageId: string;
    provider: 'gmail' | 'outlook';
    subject: string;
    from: string;
    body: string;
    receivedAt: Date;
    trackingNumber?: string | null;
    carrier?: string | null;
    completenessScore: number;
    isTrackingEmail: boolean;
  }): Promise<UnparsedEmail> {
    return this.repository.create({
      ...data,
      status: 'pending',
    });
  }

  async findPendingByUserId(userId: string, limit?: number): Promise<UnparsedEmail[]> {
    return this.repository.findPendingByUserId(userId, limit);
  }

  async markProcessed(id: string): Promise<UnparsedEmail> {
    return this.repository.markProcessed(id);
  }

  async markFailed(id: string, errorMessage: string): Promise<UnparsedEmail> {
    return this.repository.updateStatus(id, 'failed', errorMessage);
  }
}
