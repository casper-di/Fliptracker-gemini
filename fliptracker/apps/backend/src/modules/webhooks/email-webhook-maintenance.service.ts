import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'crypto';
import { ConnectedEmailsService } from '../connected-emails/connected-emails.service';
import { GmailService } from '../providers/gmail/gmail.service';
import { OutlookService } from '../providers/outlook/outlook.service';
import { ConnectedEmail } from '../../domain/entities';

@Injectable()
export class EmailWebhookMaintenanceService {
  private readonly gmailRenewThresholdMs = 12 * 60 * 60 * 1000;
  private readonly outlookRenewThresholdMs = 6 * 60 * 60 * 1000;

  constructor(
    private connectedEmailsService: ConnectedEmailsService,
    private gmailService: GmailService,
    private outlookService: OutlookService,
  ) {}

  @Cron('0 * * * *')
  async renewWebhooks(): Promise<void> {
    const topicName = process.env.GMAIL_PUBSUB_TOPIC;
    const webhookBaseUrl = process.env.EMAIL_WEBHOOK_BASE_URL;
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;

    if (!topicName && !webhookBaseUrl) {
      return;
    }

    const connectedEmails = await this.connectedEmailsService.findAll();
    const now = Date.now();

    for (const connectedEmail of connectedEmails) {
      if (connectedEmail.status !== 'active') {
        continue;
      }

      if (connectedEmail.provider === 'gmail') {
        if (!topicName) {
          continue;
        }

        const needsRenew = this.needsRenewal(connectedEmail.gmailWatchExpiration, now, this.gmailRenewThresholdMs);
        if (!needsRenew) {
          continue;
        }

        await this.renewGmailWatch(connectedEmail, topicName);
      }

      if (connectedEmail.provider === 'outlook') {
        if (!webhookBaseUrl || !webhookSecret) {
          continue;
        }

        const needsRenew = this.needsRenewal(
          connectedEmail.outlookSubscriptionExpiresAt,
          now,
          this.outlookRenewThresholdMs,
        );

        if (!needsRenew) {
          continue;
        }

        await this.renewOutlookSubscription(connectedEmail, webhookBaseUrl, webhookSecret);
      }
    }
  }

  private needsRenewal(expiration: Date | undefined, now: number, thresholdMs: number): boolean {
    if (!expiration) {
      return true;
    }

    return expiration.getTime() - now <= thresholdMs;
  }

  private async renewGmailWatch(connectedEmail: ConnectedEmail, topicName: string): Promise<void> {
    try {
      const refreshed = await this.ensureValidAccessToken(connectedEmail);
      if (!refreshed?.accessToken) {
        return;
      }

      const watch = await this.gmailService.startWatch(refreshed.accessToken, topicName);
      const expiration = watch.expiration ? new Date(parseInt(watch.expiration, 10)) : undefined;

      await this.connectedEmailsService.update(connectedEmail.id, {
        gmailHistoryId: watch.historyId,
        gmailWatchExpiration: expiration,
      });
    } catch (error) {
      console.warn('[EmailWebhookMaintenance] Gmail watch renewal failed:', error?.message || error);
    }
  }

  private async renewOutlookSubscription(
    connectedEmail: ConnectedEmail,
    webhookBaseUrl: string,
    webhookSecret: string,
  ): Promise<void> {
    try {
      const refreshed = await this.ensureValidAccessToken(connectedEmail);
      if (!refreshed?.accessToken) {
        return;
      }

      const clientState = this.buildClientState(connectedEmail.id, webhookSecret);
      const notificationUrl = `${webhookBaseUrl.replace(/\/$/, '')}/webhooks/outlook`;

      const subscription = await this.outlookService.createSubscription(
        refreshed.accessToken,
        notificationUrl,
        clientState,
      );

      await this.connectedEmailsService.update(connectedEmail.id, {
        outlookSubscriptionId: subscription.id,
        outlookSubscriptionExpiresAt: new Date(subscription.expirationDateTime),
        outlookClientState: clientState,
      });
    } catch (error) {
      console.warn('[EmailWebhookMaintenance] Outlook subscription renewal failed:', error?.message || error);
    }
  }

  private buildClientState(connectedEmailId: string, secret: string): string {
    return createHash('sha256')
      .update(`${secret}:${connectedEmailId}`)
      .digest('hex');
  }

  private async ensureValidAccessToken(connectedEmail: ConnectedEmail): Promise<{ accessToken: string } | null> {
    if (!connectedEmail.accessToken) {
      return this.refreshAccessToken(connectedEmail);
    }

    const expiry = connectedEmail.expiry?.getTime() || 0;
    if (expiry && expiry - Date.now() > 5 * 60 * 1000) {
      return { accessToken: connectedEmail.accessToken };
    }

    return this.refreshAccessToken(connectedEmail);
  }

  private async refreshAccessToken(connectedEmail: ConnectedEmail): Promise<{ accessToken: string } | null> {
    try {
      const decryptedRefreshToken = this.connectedEmailsService.getDecryptedRefreshToken(connectedEmail);

      if (connectedEmail.provider === 'gmail') {
        const tokens = await this.gmailService.refreshAccessToken(decryptedRefreshToken);
        const accessToken = tokens.access_token || connectedEmail.accessToken;
        const refreshToken = tokens.refresh_token || decryptedRefreshToken;
        const expiry = tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : new Date(Date.now() + 3600 * 1000);

        if (!accessToken) {
          return null;
        }

        await this.connectedEmailsService.updateTokens(
          connectedEmail.id,
          accessToken,
          refreshToken,
          expiry,
        );

        return { accessToken };
      }

      if (connectedEmail.provider === 'outlook') {
        const tokens = await this.outlookService.refreshAccessToken(decryptedRefreshToken);
        const accessToken = tokens.accessToken || connectedEmail.accessToken;
        const refreshToken = tokens.refreshToken || decryptedRefreshToken;
        const expiry = new Date(Date.now() + tokens.expiresIn * 1000);

        if (!accessToken) {
          return null;
        }

        await this.connectedEmailsService.updateTokens(
          connectedEmail.id,
          accessToken,
          refreshToken,
          expiry,
        );

        return { accessToken };
      }

      return null;
    } catch (error) {
      console.warn('[EmailWebhookMaintenance] Token refresh failed:', error?.message || error);
      return null;
    }
  }
}
