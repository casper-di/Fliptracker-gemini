import { Injectable, Inject } from '@nestjs/common';
import { GmailService } from '../providers/gmail/gmail.service';
import { OutlookService } from '../providers/outlook/outlook.service';
import { ConnectedEmailsService } from '../connected-emails/connected-emails.service';
import { ConnectedEmail } from '../../domain/entities';
import {
  CONNECTED_EMAIL_REPOSITORY,
  IConnectedEmailRepository,
} from '../../domain/repositories';

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
    private connectedEmailsService: ConnectedEmailsService,
    @Inject(CONNECTED_EMAIL_REPOSITORY)
    private connectedEmailRepository: IConnectedEmailRepository,
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
      console.log('[EmailFetchService] Starting fetch for:', {
        email: connectedEmail.emailAddress,
        provider: connectedEmail.provider,
        hasAccessToken: !!connectedEmail.accessToken,
        accessTokenLength: connectedEmail.accessToken?.length,
        status: connectedEmail.status,
      });
      
      // Check if token needs refresh
      const refreshedEmail = await this.ensureValidToken(connectedEmail);
      const accessToken = refreshedEmail.accessToken;
      
      console.log('[EmailFetchService] After token check:', {
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length,
      });

      if (!accessToken) {
        throw new Error('No access token available after refresh attempt');
      }

      let normalizedEmails;
      
      if (connectedEmail.provider === 'gmail') {
        const gmailEmails = await this.gmailService.fetchRecentEmails(accessToken, limit);
        normalizedEmails = gmailEmails.map(email => ({
          messageId: email.id,
          subject: email.subject,
          from: email.from,
          body: email.body,
          receivedAt: email.date,
        }));
      } else if (connectedEmail.provider === 'outlook') {
        const outlookEmails = await this.outlookService.fetchRecentEmails(accessToken, limit);
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
    } catch (error: any) {
      // Handle 401 Unauthorized errors - token is invalid/revoked
      if (error?.response?.status === 401 || error?.status === 401 || error?.message?.includes('Invalid Credentials')) {
        console.error(`[EmailFetchService] 🔴 Authentication failed for ${connectedEmail.emailAddress}`);
        console.error(`[EmailFetchService] Token is invalid or revoked - user needs to reconnect`);
        
        // Mark account as expired so user knows to reconnect
        try {
          await this.connectedEmailRepository.update(connectedEmail.id, {
            status: 'expired' as const,
          });
          console.log(`[EmailFetchService] Marked ${connectedEmail.emailAddress} as expired`);
        } catch (updateError) {
          console.error('[EmailFetchService] Failed to mark account as expired:', updateError);
        }
      }
      
      console.error('[EmailFetchService] Failed to fetch emails:', error?.message || error);
      throw error;
    }
  }

  /**
   * Ensure token is valid, refresh if needed
   */
  private async ensureValidToken(connectedEmail: ConnectedEmail): Promise<ConnectedEmail> {
    const now = new Date();
    
    // If token expires in less than 5 minutes, refresh it
    if (connectedEmail.expiry && connectedEmail.expiry.getTime() - now.getTime() < 5 * 60 * 1000) {
      console.log(`[EmailFetchService] Token expiring soon for ${connectedEmail.emailAddress}, refreshing...`);
      
      try {
        // 🔑 DECRYPT the refresh token before using it
        const decryptedRefreshToken = this.connectedEmailsService.getDecryptedRefreshToken(connectedEmail);
        console.log('[EmailFetchService] Decrypted refresh token length:', decryptedRefreshToken?.length);
        
        if (connectedEmail.provider === 'gmail') {
          const newTokens = await this.gmailService.refreshAccessToken(decryptedRefreshToken);
          const expiryDate = newTokens.expiry_date
            ? new Date(newTokens.expiry_date)
            : new Date(Date.now() + 3600 * 1000); // Default 1 hour
          
          const updatedEmail = await this.connectedEmailRepository.update(connectedEmail.id, {
            accessToken: newTokens.access_token || connectedEmail.accessToken,
            refreshToken: newTokens.refresh_token || connectedEmail.refreshToken,
            expiry: expiryDate,
            status: 'active' as const,
          });
          console.log(`[EmailFetchService] Token refreshed successfully for ${connectedEmail.emailAddress}`);
          return updatedEmail;
        } else if (connectedEmail.provider === 'outlook') {
          const newTokens = await this.outlookService.refreshAccessToken(decryptedRefreshToken);
          const expiryDate = new Date(Date.now() + newTokens.expiresIn * 1000);
          
          const updatedEmail = await this.connectedEmailRepository.update(connectedEmail.id, {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken || connectedEmail.refreshToken,
            expiry: expiryDate,
            status: 'active' as const,
          });
          console.log(`[EmailFetchService] Token refreshed successfully for ${connectedEmail.emailAddress}`);
          return updatedEmail;
        }
      } catch (error) {
        console.error(
          `[EmailFetchService] Failed to refresh token for ${connectedEmail.emailAddress}:`,
          error,
        );
        // Mark as expired but continue with current token (might still work)
        await this.connectedEmailRepository.update(connectedEmail.id, {
          status: 'expired' as const,
        });
      }
    }
    
    return connectedEmail;
  }
}
