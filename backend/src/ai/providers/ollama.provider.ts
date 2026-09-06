import { Injectable, NotImplementedException } from '@nestjs/common';
import type { AiProvider } from '../ai-provider.interface.js';
import type { AiAnalysisResult } from '../ai-result.types.js';
import type { AnalysisFacts } from '../../static-analysis/facts.types.js';

/**
 * Adapter stub para un modelo local vía Ollama — mismo contrato que
 * ClaudeProvider. Es la opción a activar si algún día se necesita analizar
 * repos sin mandar código a una API externa (dato sensible/banco).
 */
@Injectable()
export class OllamaProvider implements AiProvider {
  readonly name = 'ollama';

  async analyze(_facts: AnalysisFacts): Promise<AiAnalysisResult> {
    throw new NotImplementedException(
      'El proveedor Ollama (modelo local) todavía no está implementado — usá AI_PROVIDER=claude.',
    );
  }
}
