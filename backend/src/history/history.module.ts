import { Module } from '@nestjs/common';
import { DynamoModule } from './dynamo.module.js';
import { HistoryService } from './history.service.js';
import { HistoryController } from './history.controller.js';

@Module({
  imports: [DynamoModule],
  controllers: [HistoryController],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
