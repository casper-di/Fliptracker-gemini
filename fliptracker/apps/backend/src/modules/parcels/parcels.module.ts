import { Module } from '@nestjs/common';
import { ParcelsService } from './parcels.service';
import { ParcelsController } from './parcels.controller';
import { FirestoreParcelRepository } from '../../infrastructure/repositories/firestore-parcel.repository';
import { FirestoreParcelReportRepository } from '../../infrastructure/repositories/firestore-parcel-report.repository';
import { PARCEL_REPOSITORY, PARCEL_REPORT_REPOSITORY } from '../../domain/repositories';

@Module({
  controllers: [ParcelsController],
  providers: [
    ParcelsService,
    {
      provide: PARCEL_REPOSITORY,
      useClass: FirestoreParcelRepository,
    },
    {
      provide: PARCEL_REPORT_REPOSITORY,
      useClass: FirestoreParcelReportRepository,
    },
  ],
  exports: [ParcelsService, PARCEL_REPOSITORY, PARCEL_REPORT_REPOSITORY],
})
export class ParcelsModule {}
