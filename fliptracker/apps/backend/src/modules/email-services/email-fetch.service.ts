import { Injectable } from '@nestjs/common';
import { GmailService } from '../providers/gmail/gmail.service';
import { OutlookService } from '../providers/outlook/outlook.service';
import { ConnectedEmail } from '../../domain/entities';

export interface FetchedEmail {
  messageId: string;
  subject: string;
  from: string;
  body: string;
  receivedAt: Date;
}

@Injectable()
export class EmailFetchService {
  constructor(
    private gmailService: GmailService,
    private outlookService: OutlookService,
  ) {}

  /**
   * Fetch emails from provider and normalize to FetchedEmail format
   * @param connectedEmail Connected email account
   * @param limit Number of recent emails to fetch
   */
  async fetchEmails(
    connectedEmail: ConnectedEmail,
    limit: number = 50,
  ): Promise<FetchedEmail[]> {
    try {
      let normalizedEmails;
      
      if (connectedEmail.provider === 'gmail') {
        const gmailEmails = await this.gmailService.fetchRecentEmails(connectedEmail.accessToken, limit);
        normalizedEmails = gmailEmails.map(email => ({
          messageId: email.id,
          subject: email.subject,
          from: email.from,
          body: email.body,
          receivedAt: email.date,
        }));
      } else if (connectedEmail.provider === 'outlook') {
        const outlookEmails = await this.outlookService.fetchRecentEmails(connectedEmail.accessToken, limit);
        // Outlook NormalizedEmail has conversationId instead of threadId
        normalizedEmails = outlookEmails.map(email => ({
          messageId: email.id,
          subject: email.subject,
          from: email.from,
          body: email.body,
          receivedAt: email.date,
        }));
      } else {
        throw new Error(`Unsupported provider: ${connectedEmail.provider}`);
      }
      
      return normalizedEmails;
    } catch (error) {
      console.error('[EmailFetchService] Failed to fetch emails:', error);
      throw error;
    }
  }
}
