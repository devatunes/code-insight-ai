import type { AnalysisFacts } from '../static-analysis/facts.types.js';
import type { AiAnalysisResult } from '../ai/ai-result.types.js';

/**
 * Forma del ítem tal cual se guarda en DynamoDB: un documento por análisis,
 * sin tablas relacionadas — facts y el resultado de la IA quedan anidados
 * en el mismo ítem (ver justificación de DynamoDB vs. relacional).
 */
export interface AnalysisRecord {
  id: string;
  repoUrl: string;
  createdAt: string; // ISO
  facts: AnalysisFacts;
  ai: AiAnalysisResult;
  aiProvider: string;
}
