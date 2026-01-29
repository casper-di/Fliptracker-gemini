import { Module } from '@nestjs/common';
import { ConnectedEmailsService } from './connected-emails.service';
import { ConnectedEmailsController } from './connected-emails.controller';
import { InMemoryConnectedEmailRepository } from '../../infrastructure/repositories/in-memory-connected-email.repository';
import { CONNECTED_EMAIL_REPOSITORY } from '../../domain/repositories';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  controllers: [ConnectedEmailsController],
  providers: [
    ConnectedEmailsService,
    {
      provide: CONNECTED_EMAIL_REPOSITORY,
      useClass: InMemoryConnectedEmailRepository,
    },
  ],
  exports: [ConnectedEmailsService],
})
export class ConnectedEmailsModule {}
