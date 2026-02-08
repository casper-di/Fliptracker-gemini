import { Body, Controller, Get, Headers, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { EmailSyncOrchestrator } from '../email-services/email-sync.orchestrator';
import { ConnectedEmailsService } from '../connected-emails/connected-emails.service';

interface GmailPushMessage {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

interface GmailNotificationPayload {
  emailAddress?: string;
  historyId?: string;
}

interface OutlookNotification {
  subscriptionId?: string;
  clientState?: string;
  changeType?: string;
  resource?: string;
}

interface OutlookWebhookBody {
  value?: OutlookNotification[];
}

@Controller('webhooks')
export class EmailWebhooksController {
  constructor(
    private emailSyncOrchestrator: EmailSyncOrchestrator,
    private connectedEmailsService: ConnectedEmailsService,
  ) {}

  private validateSharedSecret(secretHeader?: string): boolean {
    const expected = process.env.EMAIL_WEBHOOK_SECRET;
    if (!expected) {
      return true;
    }
    return secretHeader === expected;
  }

  @Post('gmail')
  async handleGmailWebhook(
    @Body() body: GmailPushMessage,
    @Headers('x-webhook-secret') secretHeader: string | undefined,
    @Res() res: Response,
  ) {
    if (!this.validateSharedSecret(secretHeader)) {
      return res.status(401).send();
    }

    const payload = body?.message?.data;
    if (!payload) {
      return res.status(204).send();
    }

    let decoded: GmailNotificationPayload | null = null;
    try {
      decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    } catch (error) {
      console.warn('[EmailWebhooksController] Invalid Gmail payload:', error?.message || error);
      return res.status(204).send();
    }

    if (!decoded?.emailAddress) {
      return res.status(204).send();
    }

    const connected = await this.connectedEmailsService.findByEmailAddressAndProvider(
      decoded.emailAddress,
      'gmail',
    );
    if (!connected) {
      return res.status(204).send();
    }

    if (decoded.historyId) {
      await this.connectedEmailsService.update(connected.id, {
        gmailHistoryId: decoded.historyId,
      });
    }

    this.emailSyncOrchestrator.syncEmailsForUser(connected.userId).catch((error) => {
      console.error('[EmailWebhooksController] Gmail sync failed:', error?.message || error);
    });

    return res.status(204).send();
  }

  @Get('outlook')
  async handleOutlookValidation(@Query('validationToken') validationToken: string | undefined, @Res() res: Response) {
    if (validationToken) {
      return res.status(200).send(validationToken);
    }

    return res.status(400).send('Missing validationToken');
  }

  @Post('outlook')
  async handleOutlookWebhook(
    @Body() body: OutlookWebhookBody,
    @Res() res: Response,
    @Query('validationToken') validationToken?: string,
    @Headers('x-webhook-secret') secretHeader?: string,
  ) {
    if (validationToken) {
      return res.status(200).send(validationToken);
    }

    if (!this.validateSharedSecret(secretHeader)) {
      return res.status(401).send('Unauthorized');
    }

    const notifications = body?.value || [];
    for (const notification of notifications) {
      if (!notification?.subscriptionId) {
        continue;
      }

      const connected = await this.connectedEmailsService.findByOutlookSubscriptionId(
        notification.subscriptionId,
      );
      if (!connected) {
        continue;
      }

      if (connected.outlookClientState && notification.clientState !== connected.outlookClientState) {
        continue;
      }

      this.emailSyncOrchestrator.syncEmailsForUser(connected.userId).catch((error) => {
        console.error('[EmailWebhooksController] Outlook sync failed:', error?.message || error);
      });
    }

    return res.status(202).send();
  }
}
