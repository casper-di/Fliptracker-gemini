import { Module, forwardRef } from '@nestjs/common';
import { EmailFetchService } from './email-fetch.service';
import { EmailTrackingDetectorService } from './email-tracking-detector.service';
import { EmailClassifierService } from './email-classifier.service';
import { ParsedEmailToParcelService } from './parsed-email-to-parcel.service';
import { EmailSyncOrchestrator } from './email-sync.orchestrator';
import { NlpClientService } from './nlp-client.service';
import { StatusDetectorService } from './status-detector.service';
import { AddressExtractorService } from './utils/address-extractor.service';
import { TrackingValidatorService } from './utils/tracking-validator.service';
import { DateParserService } from './utils/date-parser.service';
import { QRCodeExtractorService } from './utils/qr-code-extractor.service';
import { MarketplaceDetectorService } from './utils/marketplace-detector.service';
import { WithdrawalCodeExtractorService } from './utils/withdrawal-code-extractor.service';
import { LabelUrlExtractorService } from './utils/label-url-extractor.service';
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
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ProvidersModule, forwardRef(() => ConnectedEmailsModule), UsersModule, ParcelsModule, forwardRef(() => AuthModule)],
  providers: [
    EmailFetchService,
    EmailTrackingDetectorService,
    EmailClassifierService,
    ParsedEmailToParcelService,
    NlpClientService,
    EmailSyncOrchestrator,
    StatusDetectorService,
    AddressExtractorService,
    TrackingValidatorService,
    DateParserService,
    QRCodeExtractorService,
    MarketplaceDetectorService,
    WithdrawalCodeExtractorService,
    LabelUrlExtractorService,
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

