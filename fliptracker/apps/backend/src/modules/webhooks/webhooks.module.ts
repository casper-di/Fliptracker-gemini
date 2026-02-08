import { Module } from '@nestjs/common';
import { EmailWebhooksController } from './email-webhooks.controller';
import { ConnectedEmailsModule } from '../connected-emails/connected-emails.module';
import { EmailServicesModule } from '../email-services/email-services.module';
import { ProvidersModule } from '../providers/providers.module';
import { EmailWebhookMaintenanceService } from './email-webhook-maintenance.service';

@Module({
  imports: [ConnectedEmailsModule, EmailServicesModule, ProvidersModule],
  controllers: [EmailWebhooksController],
  providers: [EmailWebhookMaintenanceService],
})
export class WebhooksModule {}
