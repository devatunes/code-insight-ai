export interface DetectedComponent {
  type: string; // ej: 'controller', 'service', 'component', 'entity', 'port', 'adapter'
  name: string;
  path: string;
}

export interface DetectedTechnology {
  category: 'language' | 'framework' | 'database' | 'other';
  name: string;
  evidence: string; // qué archivo/línea llevó a detectarlo
}

export interface ArchitectureHint {
  pattern: string; // ej: 'MVC', 'Hexagonal', 'Microservicios'
  confidence: 'low' | 'medium' | 'high';
  evidence: string[];
}

/**
 * Salida de la heurística local (static-analysis). Son los "hechos duros"
 * que después se le pasan a la IA como contexto — la IA nunca inventa
 * conteos ni nombres de archivo, solo redacta/interpreta sobre esto.
 */
export interface AnalysisFacts {
  projectName: string;
  fileCount: number;
  filesByExtension: Record<string, number>;
  primaryLanguage: string | null;
  technologies: DetectedTechnology[];
  components: DetectedComponent[];
  architectureHints: ArchitectureHint[];
  topLevelFolders: string[];
}
