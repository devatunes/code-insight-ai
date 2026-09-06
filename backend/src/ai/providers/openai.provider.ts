import { Injectable, NotImplementedException } from '@nestjs/common';
import type { AiProvider } from '../ai-provider.interface.js';
import type { AiAnalysisResult } from '../ai-result.types.js';
import type { AnalysisFacts } from '../../static-analysis/facts.types.js';

/**
 * Adapter listo para completar: implementa el mismo contrato AiProvider
 * que ClaudeProvider, pero no llama a ninguna API real todavía. Cambiar
 * AI_PROVIDER=openai y agregar el SDK + OPENAI_API_KEY alcanza para
 * activarlo el día que se complete — el resto del backend no cambia.
 */
@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';

  async analyze(_facts: AnalysisFacts): Promise<AiAnalysisResult> {
    throw new NotImplementedException(
      'El proveedor OpenAI todavía no está implementado — usá AI_PROVIDER=claude.',
    );
  }
}
