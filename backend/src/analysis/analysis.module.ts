import { Module } from '@nestjs/common';
import { IngestionModule } from '../ingestion/ingestion.module.js';
import { StaticAnalysisModule } from '../static-analysis/static-analysis.module.js';
import { AiModule } from '../ai/ai.module.js';
import { HistoryModule } from '../history/history.module.js';
import { AnalysisService } from './analysis.service.js';
import { AnalysisController } from './analysis.controller.js';

@Module({
  imports: [IngestionModule, StaticAnalysisModule, AiModule, HistoryModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
