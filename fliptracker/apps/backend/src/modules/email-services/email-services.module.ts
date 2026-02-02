import { Module, forwardRef } from '@nestjs/common';
import { EmailFetchService } from './email-fetch.service';
import { EmailParsingService } from './email-parsing.service';
import { HybridEmailParsingService } from './hybrid-email-parsing.service';
import { EmailTrackingDetectorService } from './email-tracking-detector.service';
import { ParsedEmailToParcelService } from './parsed-email-to-parcel.service';
import { EmailSyncOrchestrator } from './email-sync.orchestrator';
import { CarrierDetectorService } from './carriers/carrier-detector.service';
import { VintedGoParserService } from './carriers/vinted-go-parser.service';
import { MondialRelayParserService } from './carriers/mondial-relay-parser.service';
import { ChronopostParserService } from './carriers/chronopost-parser.service';
import { ColissimoParserService } from './carriers/colissimo-parser.service';
import { DHLParserService } from './carriers/dhl-parser.service';
import { UPSParserService } from './carriers/ups-parser.service';
import { FedExParserService } from './carriers/fedex-parser.service';
import { TrackingNumberExtractorService } from './tracking-number-extractor.service';
import { ShipmentTypeDetectorService } from './shipment-type-detector.service';
import { NLPModule } from '../nlp/nlp.module';
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
  imports: [ProvidersModule, forwardRef(() => ConnectedEmailsModule), UsersModule, ParcelsModule, NLPModule],
  providers: [
    EmailFetchService,
    EmailParsingService,
    HybridEmailParsingService,
    EmailTrackingDetectorService,
    ParsedEmailToParcelService,
    EmailSyncOrchestrator,
    CarrierDetectorService,
    ShipmentTypeDetectorService,
    VintedGoParserService,
    MondialRelayParserService,
    ChronopostParserService,
    ColissimoParserService,
    DHLParserService,
    UPSParserService,
    FedExParserService,
    TrackingNumberExtractorService,
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

