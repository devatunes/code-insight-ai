import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AnalysisModule } from './analysis/analysis.module.js';

@Module({
  imports: [AnalysisModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
