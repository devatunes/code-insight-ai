import { Injectable } from '@nestjs/common';
import { basename } from 'node:path';
import { FileTreeService } from './file-tree.service.js';
import { TechDetectorService } from './tech-detector.service.js';
import { ArchitectureHeuristicsService } from './architecture-heuristics.service.js';
import type { AnalysisFacts } from './facts.types.js';

@Injectable()
export class StaticAnalysisService {
  constructor(
    private readonly fileTree: FileTreeService,
    private readonly techDetector: TechDetectorService,
    private readonly architectureHeuristics: ArchitectureHeuristicsService,
  ) {}

  /**
   * `projectNameHint` viene de quien clonó el repo (nombre real derivado de
   * la URL) — `rootDir` es un directorio temporal de mkdtemp con un sufijo
   * aleatorio, nunca el nombre del proyecto, así que no sirve como fallback
   * razonable más allá de "no rompas si no hay hint".
   */
  async analyze(rootDir: string, projectNameHint?: string): Promise<AnalysisFacts> {
    const scan = await this.fileTree.scan(rootDir);
    const technologies = await this.techDetector.detect(rootDir, scan.files);
    const primaryLanguage = this.techDetector.primaryLanguage(scan.filesByExtension);
    const components = this.architectureHeuristics.detectComponents(scan.files);
    const architectureHints = this.architectureHeuristics.buildHints(scan.topLevelFolders, components);

    return {
      projectName: projectNameHint ?? basename(rootDir),
      fileCount: scan.files.length,
      filesByExtension: scan.filesByExtension,
      primaryLanguage,
      technologies,
      components,
      architectureHints,
      topLevelFolders: scan.topLevelFolders,
    };
  }
}
