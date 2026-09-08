import { Module } from '@nestjs/common';
import { IngestionModule } from '../ingestion/ingestion.module.js';
import { StaticAnalysisModule } from '../static-analysis/static-analysis.module.js';
import { AiModule } from '../ai/ai.module.js';
import { HistoryModule } from '../history/history.module.js';
import { AnalysisService } from './analysis.service.js';
import { AnalysisController } from './analysis.controller.js';
import { RateLimitGuard } from './rate-limit.guard.js';

@Module({
  imports: [IngestionModule, StaticAnalysisModule, AiModule, HistoryModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, RateLimitGuard],
})
export class AnalysisModule {}
