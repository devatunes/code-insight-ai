import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { GitCloneService } from '../ingestion/git-clone.service.js';
import { StaticAnalysisService } from '../static-analysis/static-analysis.service.js';
import { AI_PROVIDER, type AiProvider } from '../ai/ai-provider.interface.js';
import { HistoryService } from '../history/history.service.js';
import type { AnalysisRecord } from '../history/analysis-record.types.js';
import { parseRepoUrl } from '../ingestion/repo-url.js';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly gitClone: GitCloneService,
    private readonly staticAnalysis: StaticAnalysisService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    private readonly history: HistoryService,
  ) {}

  async analyzeRepo(repoUrl: string): Promise<AnalysisRecord> {
    const cloned = await this.gitClone.clone(repoUrl);

    try {
      const facts = await this.staticAnalysis.analyze(cloned.path, this.projectNameFromUrl(repoUrl));
      const aiResult = await this.aiProvider.analyze(facts);

      const record: AnalysisRecord = {
        id: randomUUID(),
        repoUrl,
        createdAt: new Date().toISOString(),
        facts,
        ai: aiResult,
        aiProvider: this.aiProvider.name,
      };

      await this.history.save(record);
      return record;
    } finally {
      // Se borra el clone haya salido bien o mal — nunca queda código de
      // terceros residente en el disco del contenedor.
      await cloned.cleanup();
    }
  }

  /**
   * "https://github.com/nestjs/typescript-starter(.git)" → "typescript-starter".
   * Usa cloneUrl (ya sin el sufijo /tree/<rama>) — tomar el último segmento
   * de la URL cruda daría el nombre de la rama, no el del repo, para URLs
   * copiadas del navegador mirando una rama específica.
   */
  private projectNameFromUrl(repoUrl: string): string {
    const { cloneUrl } = parseRepoUrl(repoUrl);
    const lastSegment = cloneUrl.split('/').pop() ?? cloneUrl;
    return lastSegment.replace(/\.git$/, '');
  }
}
