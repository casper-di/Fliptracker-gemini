import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ConnectedEmailsModule } from './modules/connected-emails/connected-emails.module';
import { ParcelsModule } from './modules/parcels/parcels.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { EmailAnalysisModule } from './modules/email-analysis/email-analysis.module';
import { EmailEventsModule } from './modules/email-events/email-events.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    ConnectedEmailsModule,
    ParcelsModule,
    ProvidersModule,
    EmailAnalysisModule,
    EmailEventsModule,
    WebhooksModule,
  ],
})
export class AppModule {}
