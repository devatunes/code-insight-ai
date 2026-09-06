import { Module } from '@nestjs/common';
import { AI_PROVIDER } from './ai-provider.interface.js';
import { ClaudeProvider } from './providers/claude.provider.js';
import { OpenAiProvider } from './providers/openai.provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { OllamaProvider } from './providers/ollama.provider.js';

/**
 * Resuelve qué AiProvider se inyecta según AI_PROVIDER (env var). El resto
 * del código (analysis.service) solo depende del token AI_PROVIDER, nunca
 * de una implementación concreta — así se cambia de proveedor sin tocar
 * lógica de negocio.
 */
@Module({
  providers: [
    ClaudeProvider,
    OpenAiProvider,
    GeminiProvider,
    OllamaProvider,
    {
      provide: AI_PROVIDER,
      useFactory: (claude: ClaudeProvider, openai: OpenAiProvider, gemini: GeminiProvider, ollama: OllamaProvider) => {
        switch (process.env.AI_PROVIDER ?? 'claude') {
          case 'openai':
            return openai;
          case 'gemini':
            return gemini;
          case 'ollama':
            return ollama;
          case 'claude':
          default:
            return claude;
        }
      },
      inject: [ClaudeProvider, OpenAiProvider, GeminiProvider, OllamaProvider],
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
