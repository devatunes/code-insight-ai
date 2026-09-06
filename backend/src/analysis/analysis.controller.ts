import { Body, Controller, Post } from '@nestjs/common';
import { AnalysisService } from './analysis.service.js';
import { CreateAnalysisDto } from './dto/create-analysis.dto.js';

@Controller('analyses')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Post()
  create(@Body() dto: CreateAnalysisDto) {
    return this.analysis.analyzeRepo(dto.repoUrl);
  }
}
