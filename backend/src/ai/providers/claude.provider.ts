import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider } from '../ai-provider.interface.js';
import type { AiAnalysisResult } from '../ai-result.types.js';
import type { AnalysisFacts } from '../../static-analysis/facts.types.js';

const RETURN_ANALYSIS_TOOL = {
  name: 'return_analysis',
  description: 'Devuelve el análisis funcional y arquitectónico del repositorio.',
  input_schema: {
    type: 'object' as const,
    properties: {
      functionalSummary: {
        type: 'string',
        description: 'Explicación en 2-4 oraciones de qué hace la aplicación, en lenguaje simple.',
      },
      inferredArchitecture: {
        type: 'string',
        enum: ['Monolito', 'MVC', 'Clean Architecture', 'Hexagonal', 'Microservicios', 'N-Capas'],
      },
      architectureEvidence: {
        type: 'array',
        items: { type: 'string' },
        description: 'Evidencia concreta (carpetas, archivos) que justifica el patrón elegido.',
      },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['recommendation', 'risk'] },
            description: { type: 'string' },
          },
          required: ['category', 'description'],
        },
      },
      architectureDiagramMermaid: {
        type: 'string',
        description: 'Diagrama de la arquitectura del repo analizado, en sintaxis Mermaid (graph TD o similar).',
      },
    },
    required: [
      'functionalSummary',
      'inferredArchitecture',
      'architectureEvidence',
      'findings',
      'architectureDiagramMermaid',
    ],
  },
};

/**
 * Único proveedor funcional. Usa tool use forzado (tool_choice) en vez de
 * pedir "devolveme JSON" en el prompt — así la respuesta siempre matchea
 * el schema, sin parseo frágil de texto libre.
 */
@Injectable()
export class ClaudeProvider implements AiProvider {
  readonly name = 'claude';
  private readonly logger = new Logger(ClaudeProvider.name);
  private readonly model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';
  private client: Anthropic | null = null;

  /**
   * El cliente se crea recién al primer uso, no en el constructor: Nest
   * instancia todos los providers del módulo al arrancar (incluidos los
   * que AI_PROVIDER no seleccionó), así que exigir la API key acá tumbaría
   * el arranque incluso corriendo con un provider stub.
   */
  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new InternalServerErrorException(
          'ANTHROPIC_API_KEY no configurada — requerida para AI_PROVIDER=claude.',
        );
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async analyze(facts: AnalysisFacts): Promise<AiAnalysisResult> {
    const message = await this.getClient().messages.create({
      model: this.model,
      // 2048 se quedaba corto en repos con muchos componentes/hallazgos: Claude
      // genera el JSON en el orden del schema y "architectureDiagramMermaid" es
      // el último campo, así que un corte por límite de tokens rompe justo el
      // diagrama (ausente o con sintaxis incompleta) antes que cualquier otro campo.
      max_tokens: 4096,
      tools: [RETURN_ANALYSIS_TOOL],
      tool_choice: { type: 'tool', name: 'return_analysis' },
      messages: [
        {
          role: 'user',
          content: this.buildPrompt(facts),
        },
      ],
    });

    const toolUse = message.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new InternalServerErrorException('Claude no devolvió un análisis estructurado.');
    }

    if (message.stop_reason === 'max_tokens') {
      this.logger.warn('La respuesta de Claude se cortó por max_tokens — puede venir incompleta.');
    }

    this.logger.log(`Análisis generado con ${this.model}`);
    const result = toolUse.input as AiAnalysisResult;
    result.architectureDiagramMermaid = this.sanitizeMermaid(
      result.architectureDiagramMermaid,
      result.inferredArchitecture,
    );
    return result;
  }

  /**
   * "required" en el tool schema es solo una guía para el modelo, Anthropic
   * no lo fuerza — a veces Claude omite este campo (es el último del schema)
   * o entrega un texto que no es Mermaid válido. Si el frontend recibe eso,
   * Mermaid no siempre lanza una excepción atrapable: en varios casos
   * renderiza su propio SVG de "Syntax error" como si fuera un resultado
   * exitoso. Mejor nunca dejar pasar un valor dudoso.
   */
  private sanitizeMermaid(diagram: string | undefined, architecture: string): string {
    const looksValid =
      typeof diagram === 'string' &&
      diagram.trim().length > 0 &&
      /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram)/i.test(diagram.trim());

    if (looksValid) return diagram!.trim();

    this.logger.warn('Claude no devolvió un diagrama Mermaid válido — se usa uno de respaldo.');
    return `graph TD\n  A[Repositorio] --> B[Arquitectura: ${architecture}]`;
  }

  private buildPrompt(facts: AnalysisFacts): string {
    return [
      'Sos un analista de arquitectura de software. A continuación tenés HECHOS extraídos',
      'de forma determinista (no inventados) sobre un repositorio de código, en JSON.',
      'Con base SOLO en estos hechos, generá el análisis pedido por la herramienta',
      '"return_analysis". No inventes archivos, componentes ni tecnologías que no estén',
      'en los hechos. Si la evidencia es débil o ambigua, elegí el patrón más probable',
      'y decilo con evidencia honesta (podés incluir "Monolito" si no hay señales claras',
      'de otro patrón). Completá SIEMPRE los 5 campos de la herramienta, sin',
      'omitir ninguno — en particular "architectureDiagramMermaid" nunca puede',
      'quedar vacío: si la evidencia es poca, generá igual un diagrama simple',
      '(por ejemplo "graph TD" con 2-3 nodos) en vez de omitirlo.',
      '',
      'HECHOS:',
      JSON.stringify(facts, null, 2),
    ].join('\n');
  }
}
