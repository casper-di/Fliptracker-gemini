import { Module } from '@nestjs/common';
import { EmailAnalyzerService } from './email-analyzer.service';
import { ParcelsModule } from '../parcels/parcels.module';

@Module({
  imports: [ParcelsModule],
  providers: [EmailAnalyzerService],
  exports: [EmailAnalyzerService],
})
export class EmailAnalysisModule {}
