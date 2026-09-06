import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DetectedTechnology } from './facts.types.js';
import type { FileTreeEntry } from './file-tree.service.js';

const FRAMEWORK_DEPENDENCY_HINTS: Record<string, string> = {
  '@nestjs/core': 'NestJS',
  express: 'Express',
  '@angular/core': 'Angular',
  react: 'React',
  vue: 'Vue',
  next: 'Next.js',
  django: 'Django',
  flask: 'Flask',
  'spring-boot-starter': 'Spring Boot',
};

const GO_FRAMEWORK_IMPORT_HINTS: Record<string, string> = {
  'github.com/gin-gonic/gin': 'Gin',
  'github.com/labstack/echo': 'Echo',
  'github.com/gofiber/fiber': 'Fiber',
  'github.com/beego/beego': 'Beego',
  'github.com/gorilla/mux': 'Gorilla Mux',
};

/**
 * Lee manifiestos de dependencias (package.json, pom.xml, requirements.txt)
 * para detectar lenguaje/framework a partir de datos declarados por el
 * propio proyecto, en vez de adivinar solo por extensión de archivo.
 */
@Injectable()
export class TechDetectorService {
  async detect(rootDir: string, files: FileTreeEntry[]): Promise<DetectedTechnology[]> {
    const technologies: DetectedTechnology[] = [];

    // No solo la raíz: en un monorepo (backend/package.json, frontend/package.json,
    // sin package.json en la raíz o con uno vacío de solo scripts) el framework
    // real vive en los manifiestos anidados, no en el de más arriba.
    const packageJsonFiles = files.filter((f) => f.name === 'package.json');
    if (packageJsonFiles.length > 0) {
      technologies.push({ category: 'language', name: 'JavaScript/TypeScript', evidence: 'package.json presente' });

      const seenFrameworks = new Set<string>();
      for (const packageJson of packageJsonFiles) {
        const frameworks = await this.detectFrameworksFromPackageJson(rootDir, packageJson.path);
        for (const framework of frameworks) {
          if (seenFrameworks.has(framework.name)) continue;
          seenFrameworks.add(framework.name);
          technologies.push(framework);
        }
      }
    }

    const pomXml = files.find((f) => f.path === 'pom.xml');
    if (pomXml) {
      technologies.push({ category: 'language', name: 'Java', evidence: 'pom.xml presente' });
      const content = await this.readSafe(join(rootDir, 'pom.xml'));
      if (content?.includes('spring-boot-starter')) {
        technologies.push({
          category: 'framework',
          name: 'Spring Boot',
          evidence: 'pom.xml declara spring-boot-starter',
        });
      }
    }

    technologies.push(...(await this.detectPython(rootDir, files)));
    technologies.push(...(await this.detectRuby(rootDir, files)));
    technologies.push(...(await this.detectPhp(rootDir, files)));
    technologies.push(...(await this.detectGo(rootDir, files)));

    return technologies;
  }

  /**
   * "requirements.txt" es solo UNO de varios manifiestos que un proyecto
   * Python real puede usar (Pipfile, pyproject.toml, setup.py) — y ninguno
   * es garantía de encontrar el framework ahí si el repo separa
   * dependencias en varios archivos. `manage.py` es una señal mucho más
   * confiable y específica de Django: ese archivo casi no existe fuera de
   * un proyecto Django.
   */
  private async detectPython(rootDir: string, files: FileTreeEntry[]): Promise<DetectedTechnology[]> {
    const manifestPaths = files
      .filter((f) => ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py'].includes(f.name))
      .map((f) => f.path);
    const hasManagePy = files.some((f) => f.name === 'manage.py');

    if (manifestPaths.length === 0 && !hasManagePy) return [];

    const technologies: DetectedTechnology[] = [
      {
        category: 'language',
        name: 'Python',
        evidence: hasManagePy ? 'manage.py presente' : `${manifestPaths[0]} presente`,
      },
    ];

    if (hasManagePy) {
      technologies.push({ category: 'framework', name: 'Django', evidence: 'manage.py presente (señal específica de Django)' });
    } else {
      const combinedContent = (
        await Promise.all(manifestPaths.map((p) => this.readSafe(join(rootDir, p))))
      )
        .filter((c): c is string => c !== null)
        .join('\n')
        .toLowerCase();

      if (combinedContent.includes('django')) {
        technologies.push({ category: 'framework', name: 'Django', evidence: `${manifestPaths.join(', ')} declara Django` });
      } else if (combinedContent.includes('flask')) {
        technologies.push({ category: 'framework', name: 'Flask', evidence: `${manifestPaths.join(', ')} declara Flask` });
      }
    }

    return technologies;
  }

  private async detectRuby(rootDir: string, files: FileTreeEntry[]): Promise<DetectedTechnology[]> {
    const gemfile = files.find((f) => f.name === 'Gemfile');
    if (!gemfile) return [];

    const technologies: DetectedTechnology[] = [
      { category: 'language', name: 'Ruby', evidence: 'Gemfile presente' },
    ];

    const content = (await this.readSafe(join(rootDir, gemfile.path)))?.toLowerCase();
    if (content?.includes("'rails'") || content?.includes('"rails"')) {
      technologies.push({ category: 'framework', name: 'Ruby on Rails', evidence: 'Gemfile declara la gema rails' });
    }

    return technologies;
  }

  private async detectPhp(rootDir: string, files: FileTreeEntry[]): Promise<DetectedTechnology[]> {
    const composerJson = files.find((f) => f.name === 'composer.json');
    if (!composerJson) return [];

    const technologies: DetectedTechnology[] = [
      { category: 'language', name: 'PHP', evidence: 'composer.json presente' },
    ];

    const content = await this.readSafe(join(rootDir, composerJson.path));
    if (content) {
      try {
        const parsed: { require?: Record<string, string> } = JSON.parse(content);
        if (parsed.require?.['laravel/framework']) {
          technologies.push({
            category: 'framework',
            name: 'Laravel',
            evidence: `${composerJson.path} declara dependencia "laravel/framework"`,
          });
        }
      } catch {
        // composer.json inválido — nos quedamos solo con el lenguaje detectado arriba.
      }
    }

    return technologies;
  }

  private async detectGo(rootDir: string, files: FileTreeEntry[]): Promise<DetectedTechnology[]> {
    const goMod = files.find((f) => f.name === 'go.mod');
    if (!goMod) return [];

    const technologies: DetectedTechnology[] = [
      { category: 'language', name: 'Go', evidence: 'go.mod presente' },
    ];

    const content = await this.readSafe(join(rootDir, goMod.path));
    if (content) {
      for (const [importPath, frameworkName] of Object.entries(GO_FRAMEWORK_IMPORT_HINTS)) {
        if (content.includes(importPath)) {
          technologies.push({
            category: 'framework',
            name: frameworkName,
            evidence: `${goMod.path} declara dependencia "${importPath}"`,
          });
        }
      }
    }

    return technologies;
  }

  primaryLanguage(filesByExtension: Record<string, number>): string | null {
    const extensionToLanguage: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.java': 'Java',
      '.py': 'Python',
      '.go': 'Go',
      '.rb': 'Ruby',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rs': 'Rust',
      '.kt': 'Kotlin',
      '.kts': 'Kotlin',
      '.swift': 'Swift',
      '.scala': 'Scala',
      '.ex': 'Elixir',
      '.exs': 'Elixir',
      '.c': 'C',
      '.h': 'C',
      '.cpp': 'C++',
      '.cc': 'C++',
      '.hpp': 'C++',
      '.dart': 'Dart',
    };

    let bestExtension: string | null = null;
    let bestCount = 0;
    for (const [ext, count] of Object.entries(filesByExtension)) {
      if (extensionToLanguage[ext] && count > bestCount) {
        bestExtension = ext;
        bestCount = count;
      }
    }

    return bestExtension ? extensionToLanguage[bestExtension] : null;
  }

  private async detectFrameworksFromPackageJson(rootDir: string, packageJsonPath: string): Promise<DetectedTechnology[]> {
    const content = await this.readSafe(join(rootDir, packageJsonPath));
    if (!content) return [];

    let parsed: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
      parsed = JSON.parse(content);
    } catch {
      return [];
    }

    const allDeps = { ...parsed.dependencies, ...parsed.devDependencies };
    const technologies: DetectedTechnology[] = [];

    for (const [dep, frameworkName] of Object.entries(FRAMEWORK_DEPENDENCY_HINTS)) {
      if (allDeps[dep]) {
        technologies.push({
          category: 'framework',
          name: frameworkName,
          evidence: `${packageJsonPath} declara dependencia "${dep}"`,
        });
      }
    }

    return technologies;
  }

  private async readSafe(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf-8');
    } catch {
      return null;
    }
  }
}
