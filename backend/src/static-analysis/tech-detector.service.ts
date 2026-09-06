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

    const requirementsTxt = files.find((f) => f.path === 'requirements.txt');
    if (requirementsTxt) {
      technologies.push({
        category: 'language',
        name: 'Python',
        evidence: 'requirements.txt presente',
      });
      const content = await this.readSafe(join(rootDir, 'requirements.txt'));
      if (content?.toLowerCase().includes('django')) {
        technologies.push({
          category: 'framework',
          name: 'Django',
          evidence: 'requirements.txt declara Django',
        });
      } else if (content?.toLowerCase().includes('flask')) {
        technologies.push({
          category: 'framework',
          name: 'Flask',
          evidence: 'requirements.txt declara Flask',
        });
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
