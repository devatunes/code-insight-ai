import { Injectable } from '@nestjs/common';
import type { ArchitectureHint, DetectedComponent } from './facts.types.js';
import type { FileTreeEntry } from './file-tree.service.js';

interface ComponentRule {
  type: string;
  folderNames: string[];
}

const COMPONENT_RULES: ComponentRule[] = [
  { type: 'controller', folderNames: ['controllers', 'controller'] },
  { type: 'service', folderNames: ['services', 'service'] },
  { type: 'repository', folderNames: ['repositories', 'repository', 'repos'] },
  { type: 'model', folderNames: ['models', 'model', 'entities', 'entity'] },
  { type: 'component-angular', folderNames: ['components'] },
  { type: 'port', folderNames: ['ports', 'port'] },
  { type: 'adapter', folderNames: ['adapters', 'adapter'] },
  { type: 'use-case', folderNames: ['usecases', 'use-cases', 'usecase'] },
  { type: 'dto', folderNames: ['dto', 'dtos'] },
];

/**
 * Detecta componentes y arma evidencia de patrón arquitectónico a partir
 * de convenciones de carpetas — esto es EVIDENCIA que se le pasa a la IA
 * en el prompt, no el veredicto final. La IA decide el patrón declarado
 * (uno de los 6 del brief) usando esta evidencia + su propio criterio.
 */
@Injectable()
export class ArchitectureHeuristicsService {
  detectComponents(files: FileTreeEntry[]): DetectedComponent[] {
    const components: DetectedComponent[] = [];

    for (const file of files) {
      const segments = file.path.split('/');
      for (let i = 0; i < segments.length - 1; i++) {
        const folder = segments[i].toLowerCase();
        const rule = COMPONENT_RULES.find((r) => r.folderNames.includes(folder));
        if (rule) {
          components.push({ type: rule.type, name: file.name, path: file.path });
          break;
        }
      }
    }

    return components;
  }

  buildHints(topLevelFolders: string[], components: DetectedComponent[]): ArchitectureHint[] {
    const hints: ArchitectureHint[] = [];
    const lowerFolders = topLevelFolders.map((f) => f.toLowerCase());
    const componentTypes = new Set(components.map((c) => c.type));

    if (componentTypes.has('port') && componentTypes.has('adapter')) {
      hints.push({
        pattern: 'Hexagonal',
        confidence: 'high',
        evidence: ['Carpetas ports/ y adapters/ presentes'],
      });
    }

    if (
      componentTypes.has('controller') &&
      componentTypes.has('service') &&
      componentTypes.has('repository')
    ) {
      hints.push({
        pattern: 'N-Capas',
        confidence: 'high',
        evidence: ['Carpetas controllers/, services/ y repositories/ presentes'],
      });
    } else if (componentTypes.has('controller') && componentTypes.has('model')) {
      hints.push({
        pattern: 'MVC',
        confidence: 'medium',
        evidence: ['Carpetas controllers/ y models/ presentes'],
      });
    }

    if (lowerFolders.includes('domain') && lowerFolders.includes('application') && lowerFolders.includes('infrastructure')) {
      hints.push({
        pattern: 'Clean Architecture',
        confidence: 'high',
        evidence: ['Carpetas domain/, application/ e infrastructure/ presentes'],
      });
    }

    const looksLikeMultiService =
      lowerFolders.filter((f) => ['services', 'apps', 'packages'].includes(f)).length > 0;
    if (looksLikeMultiService) {
      hints.push({
        pattern: 'Microservicios',
        confidence: 'low',
        evidence: ['Carpeta de nivel superior sugiere múltiples servicios/paquetes independientes — requiere confirmar que cada uno tenga su propio manifiesto de dependencias'],
      });
    }

    if (hints.length === 0) {
      hints.push({
        pattern: 'Monolito',
        confidence: 'low',
        evidence: ['No se detectaron carpetas que evidencien un patrón específico — se asume monolito por descarte'],
      });
    }

    return hints;
  }
}
