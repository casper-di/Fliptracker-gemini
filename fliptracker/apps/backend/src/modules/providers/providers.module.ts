import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GmailService } from './gmail/gmail.service';
import { OutlookService } from './outlook/outlook.service';
import { EncryptionService } from '../../infrastructure/services/encryption.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [GmailService, OutlookService, EncryptionService],
  exports: [GmailService, OutlookService, EncryptionService],
})
export class ProvidersModule {}
