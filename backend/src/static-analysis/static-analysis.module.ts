import { Module } from '@nestjs/common';
import { FileTreeService } from './file-tree.service.js';
import { TechDetectorService } from './tech-detector.service.js';
import { ArchitectureHeuristicsService } from './architecture-heuristics.service.js';
import { StaticAnalysisService } from './static-analysis.service.js';

@Module({
  providers: [FileTreeService, TechDetectorService, ArchitectureHeuristicsService, StaticAnalysisService],
  exports: [StaticAnalysisService],
})
export class StaticAnalysisModule {}
