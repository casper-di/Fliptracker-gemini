import { Module, forwardRef } from '@nestjs/common';
import { ConnectedEmailsService } from './connected-emails.service';
import { ConnectedEmailsController } from './connected-emails.controller';
import { FirestoreConnectedEmailRepository } from '../../infrastructure/repositories/firestore-connected-email.repository';
import { CONNECTED_EMAIL_REPOSITORY } from '../../domain/repositories';
import { ProvidersModule } from '../providers/providers.module';
import { UsersModule } from '../users/users.module';
import { EmailServicesModule } from '../email-services/email-services.module';

@Module({
  imports: [ProvidersModule, UsersModule, forwardRef(() => EmailServicesModule)],
  controllers: [ConnectedEmailsController],
  providers: [
    ConnectedEmailsService,
    {
      provide: CONNECTED_EMAIL_REPOSITORY,
      useClass: FirestoreConnectedEmailRepository,
    },
  ],
  exports: [ConnectedEmailsService, CONNECTED_EMAIL_REPOSITORY],
})
export class ConnectedEmailsModule {}
