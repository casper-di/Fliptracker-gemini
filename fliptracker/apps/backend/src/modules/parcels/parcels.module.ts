import { Module } from '@nestjs/common';
import { ParcelsService } from './parcels.service';
import { ParcelsController } from './parcels.controller';
import { FirestoreParcelRepository } from '../../infrastructure/repositories/firestore-parcel.repository';
import { PARCEL_REPOSITORY } from '../../domain/repositories';

@Module({
  controllers: [ParcelsController],
  providers: [
    ParcelsService,
    {
      provide: PARCEL_REPOSITORY,
      useClass: FirestoreParcelRepository,
    },
  ],
  exports: [ParcelsService, PARCEL_REPOSITORY],
})
export class ParcelsModule {}
