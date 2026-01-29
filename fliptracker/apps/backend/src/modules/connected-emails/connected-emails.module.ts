import { Module } from '@nestjs/common';
import { ConnectedEmailsService } from './connected-emails.service';
import { ConnectedEmailsController } from './connected-emails.controller';
import { FirestoreConnectedEmailRepository } from '../../infrastructure/repositories/firestore-connected-email.repository';
import { CONNECTED_EMAIL_REPOSITORY } from '../../domain/repositories';
import { ProvidersModule } from '../providers/providers.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ProvidersModule, UsersModule],
  controllers: [ConnectedEmailsController],
  providers: [
    ConnectedEmailsService,
    {
      provide: CONNECTED_EMAIL_REPOSITORY,
      useClass: FirestoreConnectedEmailRepository,
    },
  ],
  exports: [ConnectedEmailsService],
})
export class ConnectedEmailsModule {}
