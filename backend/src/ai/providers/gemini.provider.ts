import { Injectable, NotImplementedException } from '@nestjs/common';
import type { AiProvider } from '../ai-provider.interface.js';
import type { AiAnalysisResult } from '../ai-result.types.js';
import type { AnalysisFacts } from '../../static-analysis/facts.types.js';

/** Adapter stub — mismo contrato que ClaudeProvider, ver openai.provider.ts para el criterio. */
@Injectable()
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';

  async analyze(_facts: AnalysisFacts): Promise<AiAnalysisResult> {
    throw new NotImplementedException(
      'El proveedor Gemini todavía no está implementado — usá AI_PROVIDER=claude.',
    );
  }
}
