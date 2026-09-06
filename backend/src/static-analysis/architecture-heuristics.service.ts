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
  { type: 'ui-component', folderNames: ['components'] },
  { type: 'port', folderNames: ['ports', 'port'] },
  { type: 'adapter', folderNames: ['adapters', 'adapter'] },
  { type: 'use-case', folderNames: ['usecases', 'use-cases', 'usecase'] },
  { type: 'dto', folderNames: ['dto', 'dtos'] },
  // Convención Go: handlers/routers hacen el rol de "controller" (reciben
  // la request HTTP), middlewares el de "guard" (interceptan antes del
  // handler) — nombres que no aparecen en TS/Java pero sí son estándar acá.
  { type: 'controller', folderNames: ['handlers', 'handler', 'routers', 'router'] },
  { type: 'guard', folderNames: ['middlewares', 'middleware'] },
];

/**
 * Convención muy común (NestJS, Angular) que la sola regla de carpeta no
 * cubre: el archivo declara su rol en el propio nombre y vive directo en
 * la carpeta del módulo/dominio, sin una subcarpeta "controllers/" o
 * "services/" que lo agrupe — ej. `assessments.controller.ts` junto a
 * `assessments.service.ts` en `src/assessments/`.
 */
const FILENAME_SUFFIX_RULES: Array<{ type: string; suffix: string }> = [
  { type: 'controller', suffix: '.controller.ts' },
  { type: 'service', suffix: '.service.ts' },
  { type: 'repository', suffix: '.repository.ts' },
  { type: 'module', suffix: '.module.ts' },
  { type: 'guard', suffix: '.guard.ts' },
  { type: 'strategy', suffix: '.strategy.ts' },
  { type: 'ui-component', suffix: '.component.ts' },
  // Convención Java/Spring: PascalCase pegado al nombre, sin punto
  // (OwnerController.java, PetService.java) — Java es uno de los 2
  // lenguajes de backend que el reto permite explícitamente, así que esto
  // no es un extra: es soporte real para uno de los dos stacks del brief.
  { type: 'controller', suffix: 'controller.java' },
  { type: 'service', suffix: 'service.java' },
  { type: 'repository', suffix: 'repository.java' },
  { type: 'model', suffix: 'entity.java' },
  { type: 'dto', suffix: 'dto.java' },
];

/**
 * Convención Go de "paquete por feature": el archivo no lleva el nombre
 * del dominio ni un sufijo — el nombre COMPLETO del archivo es el rol,
 * repetido igual en cada carpeta (ej. `articles/routers.go` y
 * `users/routers.go`). Ni carpeta ni sufijo la cubren.
 */
const FILENAME_EXACT_RULES: Record<string, string> = {
  'routers.go': 'controller',
  'router.go': 'controller',
  'handlers.go': 'controller',
  'handler.go': 'controller',
  'controllers.go': 'controller',
  'controller.go': 'controller',
  'services.go': 'service',
  'service.go': 'service',
  'repositories.go': 'repository',
  'repository.go': 'repository',
  'models.go': 'model',
  'model.go': 'model',
  'serializers.go': 'dto',
  'middlewares.go': 'guard',
  'middleware.go': 'guard',
};

/**
 * Detecta componentes y arma evidencia de patrón arquitectónico a partir
 * de convenciones de carpetas y de nombre de archivo — esto es EVIDENCIA
 * que se le pasa a la IA en el prompt, no el veredicto final. La IA decide
 * el patrón declarado (uno de los 6 del brief) usando esta evidencia + su
 * propio criterio.
 */
@Injectable()
export class ArchitectureHeuristicsService {
  detectComponents(files: FileTreeEntry[]): DetectedComponent[] {
    const components: DetectedComponent[] = [];

    for (const file of files) {
      const byFolder = this.matchByFolder(file.path);
      if (byFolder) {
        components.push({ type: byFolder, name: file.name, path: file.path });
        continue;
      }

      const fileNameLower = file.name.toLowerCase();

      const bySuffix = this.matchByFilenameSuffix(fileNameLower);
      if (bySuffix) {
        components.push({ type: bySuffix, name: file.name, path: file.path });
        continue;
      }

      const byExactName = FILENAME_EXACT_RULES[fileNameLower];
      if (byExactName) {
        components.push({ type: byExactName, name: file.name, path: file.path });
      }
    }

    return components;
  }

  private matchByFolder(path: string): string | null {
    const segments = path.split('/');
    for (let i = 0; i < segments.length - 1; i++) {
      const folder = segments[i].toLowerCase();
      const rule = COMPONENT_RULES.find((r) => r.folderNames.includes(folder));
      if (rule) return rule.type;
    }
    return null;
  }

  private matchByFilenameSuffix(fileNameLower: string): string | null {
    const rule = FILENAME_SUFFIX_RULES.find((r) => fileNameLower.endsWith(r.suffix));
    return rule?.type ?? null;
  }

  buildHints(topLevelFolders: string[], components: DetectedComponent[]): ArchitectureHint[] {
    const hints: ArchitectureHint[] = [];
    const lowerFolders = topLevelFolders.map((f) => f.toLowerCase());
    const componentTypes = new Set(components.map((c) => c.type));

    // "adapter" literal es solo una de las formas en que aparece la capa de
    // infraestructura en un proyecto Ports & Adapters real — muchos usan
    // "Infrastructure" en su lugar (ver explicit-architecture-php).
    const hasAdapterLayer =
      componentTypes.has('adapter') || ['infrastructure', 'infra'].some((f) => lowerFolders.includes(f));
    if (componentTypes.has('port') && hasAdapterLayer) {
      hints.push({
        pattern: 'Hexagonal',
        confidence: 'high',
        evidence: ['Se detectaron ports y una capa de adapters/infraestructura (por carpeta o por nombre de archivo)'],
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
        evidence: ['Se detectaron controllers, services y repositories (por carpeta o por nombre de archivo)'],
      });
    } else if (componentTypes.has('controller') && componentTypes.has('model')) {
      hints.push({
        pattern: 'MVC',
        confidence: 'medium',
        evidence: ['Se detectaron controllers y models (por carpeta o por nombre de archivo)'],
      });
    }

    // Nombres alternativos comunes para las mismas 3 capas de Clean
    // Architecture — un proyecto real rara vez usa el nombre "application"
    // literal, suele ser "usecase"/"use-cases", y "infrastructure" suele
    // aparecer como "repository"/"delivery"/"adapter".
    const hasDomain = lowerFolders.includes('domain');
    const hasApplicationLayer = ['application', 'usecase', 'use-cases', 'app'].some((f) => lowerFolders.includes(f));
    const hasInfraLayer = ['infrastructure', 'infra', 'repository', 'delivery', 'adapter', 'adapters'].some((f) =>
      lowerFolders.includes(f),
    );
    if (hasDomain && hasApplicationLayer && hasInfraLayer) {
      hints.push({
        pattern: 'Clean Architecture',
        confidence: 'high',
        evidence: [`Carpetas de nivel superior típicas de Clean Architecture presentes: ${topLevelFolders.filter((f) => ['domain', 'application', 'usecase', 'use-cases', 'app', 'infrastructure', 'infra', 'repository', 'delivery', 'adapter', 'adapters'].includes(f.toLowerCase())).join(', ')}`],
      });
    }

    // Un monorepo real de microservicios rara vez tiene una carpeta LITERAL
    // llamada "services" — suele ser una carpeta por servicio, cada una con
    // su propio nombre (ej. "customers-service", "api-gateway",
    // "discovery-server"). Contar cuántas carpetas de nivel superior matchean
    // ese patrón es más representativo que buscar un nombre exacto.
    const microserviceFolderSuffixes = ['-service', '-svc', '-api', '-server', '-gateway'];
    const microserviceLikeFolders = topLevelFolders.filter((f) =>
      microserviceFolderSuffixes.some((suffix) => f.toLowerCase().endsWith(suffix)),
    );
    const looksLikeMultiService =
      lowerFolders.some((f) => ['services', 'apps', 'packages'].includes(f)) || microserviceLikeFolders.length >= 2;
    if (looksLikeMultiService) {
      hints.push({
        pattern: 'Microservicios',
        confidence: 'low',
        evidence:
          microserviceLikeFolders.length >= 2
            ? [`Varias carpetas de nivel superior con nombre de servicio independiente: ${microserviceLikeFolders.join(', ')} — requiere confirmar que cada una tenga su propio manifiesto de dependencias`]
            : ['Carpeta de nivel superior sugiere múltiples servicios/paquetes independientes — requiere confirmar que cada uno tenga su propio manifiesto de dependencias'],
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
