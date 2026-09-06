export interface AiFinding {
  category: 'recommendation' | 'risk';
  description: string;
}

/**
 * Salida común que TODO proveedor de IA debe producir, sin importar su
 * SDK/API particular — este es el contrato del patrón Strategy/Adapter.
 */
export interface AiAnalysisResult {
  functionalSummary: string;
  inferredArchitecture:
    | 'Monolito'
    | 'MVC'
    | 'Clean Architecture'
    | 'Hexagonal'
    | 'Microservicios'
    | 'N-Capas';
  architectureEvidence: string[];
  findings: AiFinding[];
  architectureDiagramMermaid: string;
}
