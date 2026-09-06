import type { AnalysisFacts } from '../static-analysis/facts.types.js';
import type { AiAnalysisResult } from './ai-result.types.js';

/**
 * Contrato Strategy/Adapter: analysis.service pide un AiProvider por DI
 * (token AI_PROVIDER, ver ai.module.ts) y nunca sabe cuál implementación
 * está activa. Cambiar de proveedor es cambiar una variable de entorno,
 * no tocar código de negocio.
 */
export interface AiProvider {
  readonly name: string;
  analyze(facts: AnalysisFacts): Promise<AiAnalysisResult>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
