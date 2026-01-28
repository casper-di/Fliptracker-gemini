import { Module } from '@nestjs/common';
import { EmailEventsService } from './email-events.service';
import { EmailEventsController } from './email-events.controller';
import { FirestoreEmailEventRepository } from '../../infrastructure/repositories/firestore-email-event.repository';
import { EMAIL_EVENT_REPOSITORY } from '../../domain/repositories';

@Module({
  controllers: [EmailEventsController],
  providers: [
    EmailEventsService,
    {
      provide: EMAIL_EVENT_REPOSITORY,
      useClass: FirestoreEmailEventRepository,
    },
  ],
  exports: [EmailEventsService],
})
export class EmailEventsModule {}
