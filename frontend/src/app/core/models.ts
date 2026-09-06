export interface DetectedComponent {
  type: string;
  name: string;
  path: string;
}

export interface DetectedTechnology {
  category: 'language' | 'framework' | 'database' | 'other';
  name: string;
  evidence: string;
}

export interface ArchitectureHint {
  pattern: string;
  confidence: 'low' | 'medium' | 'high';
  evidence: string[];
}

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

export interface AiFinding {
  category: 'recommendation' | 'risk';
  description: string;
}

export interface AiAnalysisResult {
  functionalSummary: string;
  inferredArchitecture: string;
  architectureEvidence: string[];
  findings: AiFinding[];
  architectureDiagramMermaid: string;
}

export interface AnalysisRecord {
  id: string;
  repoUrl: string;
  createdAt: string;
  facts: AnalysisFacts;
  ai: AiAnalysisResult;
  aiProvider: string;
}
