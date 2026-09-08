import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AnalysisService } from './analysis.service.js';
import { CreateAnalysisDto } from './dto/create-analysis.dto.js';
import { RateLimitGuard } from './rate-limit.guard.js';

@Controller('analyses')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Post()
  @UseGuards(RateLimitGuard)
  create(@Body() dto: CreateAnalysisDto) {
    return this.analysis.analyzeRepo(dto.repoUrl);
  }
}
