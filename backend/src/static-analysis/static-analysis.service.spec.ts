import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileTreeService } from './file-tree.service.js';
import { TechDetectorService } from './tech-detector.service.js';
import { ArchitectureHeuristicsService } from './architecture-heuristics.service.js';
import { StaticAnalysisService } from './static-analysis.service.js';

describe('StaticAnalysisService', () => {
  let fixtureDir: string;
  const service = new StaticAnalysisService(
    new FileTreeService(),
    new TechDetectorService(),
    new ArchitectureHeuristicsService(),
  );

  beforeAll(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'code-insight-fixture-'));

    await mkdir(join(fixtureDir, 'src', 'controllers'), { recursive: true });
    await mkdir(join(fixtureDir, 'src', 'services'), { recursive: true });
    await mkdir(join(fixtureDir, 'src', 'repositories'), { recursive: true });
    await mkdir(join(fixtureDir, 'node_modules', 'some-dep'), { recursive: true });

    await writeFile(
      join(fixtureDir, 'package.json'),
      JSON.stringify({ dependencies: { '@nestjs/core': '^10.0.0' } }),
    );
    await writeFile(join(fixtureDir, 'src', 'controllers', 'users.controller.ts'), '');
    await writeFile(join(fixtureDir, 'src', 'services', 'users.service.ts'), '');
    await writeFile(join(fixtureDir, 'src', 'repositories', 'users.repository.ts'), '');
    await writeFile(join(fixtureDir, 'node_modules', 'some-dep', 'index.js'), '');
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it('ignora node_modules al contar archivos', async () => {
    const facts = await service.analyze(fixtureDir);
    expect(facts.fileCount).toBe(4); // package.json + 3 archivos de src/
  });

  it('detecta NestJS por package.json', async () => {
    const facts = await service.analyze(fixtureDir);
    expect(facts.technologies.some((t) => t.name === 'NestJS')).toBe(true);
  });

  it('detecta componentes por carpeta y arma hint de N-Capas', async () => {
    const facts = await service.analyze(fixtureDir);
    const types = facts.components.map((c) => c.type);
    expect(types).toContain('controller');
    expect(types).toContain('service');
    expect(types).toContain('repository');
    expect(facts.architectureHints.some((h) => h.pattern === 'N-Capas')).toBe(true);
  });
});

describe('StaticAnalysisService — monorepo con módulos "planos" (NestJS real, sin subcarpetas por tipo)', () => {
  let fixtureDir: string;
  const service = new StaticAnalysisService(
    new FileTreeService(),
    new TechDetectorService(),
    new ArchitectureHeuristicsService(),
  );

  beforeAll(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'code-insight-fixture-monorepo-'));

    // Sin package.json en la raíz — el manifiesto real está en backend/.
    await mkdir(join(fixtureDir, 'backend', 'src', 'assessments'), { recursive: true });
    await writeFile(
      join(fixtureDir, 'backend', 'package.json'),
      JSON.stringify({ dependencies: { '@nestjs/core': '^10.0.0' } }),
    );
    // Sin carpeta controllers/ ni services/: los archivos viven directo en el módulo.
    await writeFile(join(fixtureDir, 'backend', 'src', 'assessments', 'assessments.controller.ts'), '');
    await writeFile(join(fixtureDir, 'backend', 'src', 'assessments', 'assessments.service.ts'), '');
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it('detecta framework desde un package.json anidado, no solo el de la raíz', async () => {
    const facts = await service.analyze(fixtureDir);
    expect(facts.technologies.some((t) => t.name === 'NestJS')).toBe(true);
  });

  it('detecta controller/service por sufijo de nombre de archivo aunque no estén en una subcarpeta dedicada', async () => {
    const facts = await service.analyze(fixtureDir);
    const types = facts.components.map((c) => c.type);
    expect(types).toContain('controller');
    expect(types).toContain('service');
  });
});

describe('StaticAnalysisService — Java/Spring Boot (PascalCase, sin subcarpetas por tipo)', () => {
  let fixtureDir: string;
  const service = new StaticAnalysisService(
    new FileTreeService(),
    new TechDetectorService(),
    new ArchitectureHeuristicsService(),
  );

  beforeAll(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'code-insight-fixture-java-'));

    await mkdir(join(fixtureDir, 'src', 'main', 'java', 'com', 'example', 'owner'), { recursive: true });
    await writeFile(
      join(fixtureDir, 'pom.xml'),
      '<project><dependencies><dependency><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>',
    );
    await writeFile(join(fixtureDir, 'src', 'main', 'java', 'com', 'example', 'owner', 'OwnerController.java'), '');
    await writeFile(join(fixtureDir, 'src', 'main', 'java', 'com', 'example', 'owner', 'OwnerService.java'), '');
    await writeFile(join(fixtureDir, 'src', 'main', 'java', 'com', 'example', 'owner', 'OwnerRepository.java'), '');
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it('detecta Java + Spring Boot por pom.xml', async () => {
    const facts = await service.analyze(fixtureDir);
    expect(facts.technologies.some((t) => t.name === 'Java')).toBe(true);
    expect(facts.technologies.some((t) => t.name === 'Spring Boot')).toBe(true);
  });

  it('detecta controller/service/repository por sufijo PascalCase (convención Java), sin subcarpetas', async () => {
    const facts = await service.analyze(fixtureDir);
    const types = facts.components.map((c) => c.type);
    expect(types).toContain('controller');
    expect(types).toContain('service');
    expect(types).toContain('repository');
    expect(facts.architectureHints.some((h) => h.pattern === 'N-Capas')).toBe(true);
  });
});
