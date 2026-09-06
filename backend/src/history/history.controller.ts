import { Controller, Get, Param, Query } from '@nestjs/common';
import { HistoryService } from './history.service.js';

@Controller('analyses')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.history.listRecent(limit ? Number(limit) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.history.findById(id);
  }
}
