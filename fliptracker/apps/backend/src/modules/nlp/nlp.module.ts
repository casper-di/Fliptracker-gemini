import { Module } from '@nestjs/common';
import { NLPService } from './nlp.service';

@Module({
  providers: [NLPService],
  exports: [NLPService],
})
export class NLPModule {}
