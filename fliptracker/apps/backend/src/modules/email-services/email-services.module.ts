import { Module, forwardRef } from '@nestjs/common';
import { EmailFetchService } from './email-fetch.service';
import { EmailParsingService } from './email-parsing.service';
import { EmailTrackingDetectorService } from './email-tracking-detector.service';
import { ParsedEmailToParcelService } from './parsed-email-to-parcel.service';
import { EmailSyncOrchestrator } from './email-sync.orchestrator';
import {
  RAW_EMAIL_REPOSITORY,
  PARSED_EMAIL_REPOSITORY,
  EMAIL_SYNC_EVENT_REPOSITORY,
} from '../../domain/repositories/email-sync.repository';
import {
  FirestoreRawEmailRepository,
  FirestoreParsedEmailRepository,
  FirestoreEmailSyncEventRepository,
} from '../../infrastructure/repositories/firestore-email-sync.repository';
import { ProvidersModule } from '../providers/providers.module';
import { ConnectedEmailsModule } from '../connected-emails/connected-emails.module';
import { UsersModule } from '../users/users.module';
import { ParcelsModule } from '../parcels/parcels.module';

@Module({
  imports: [ProvidersModule, forwardRef(() => ConnectedEmailsModule), UsersModule, ParcelsModule],
  providers: [
    EmailFetchService,
    EmailParsingService,
    EmailTrackingDetectorService,
    ParsedEmailToParcelService,
    EmailSyncOrchestrator,
    {
      provide: RAW_EMAIL_REPOSITORY,
      useClass: FirestoreRawEmailRepository,
    },
    {
      provide: PARSED_EMAIL_REPOSITORY,
      useClass: FirestoreParsedEmailRepository,
    },
    {
      provide: EMAIL_SYNC_EVENT_REPOSITORY,
      useClass: FirestoreEmailSyncEventRepository,
    },
  ],
  exports: [
    EmailSyncOrchestrator,
    EmailFetchService,
    RAW_EMAIL_REPOSITORY,
    PARSED_EMAIL_REPOSITORY,
    EMAIL_SYNC_EVENT_REPOSITORY,
  ],
})
export class EmailServicesModule {}

