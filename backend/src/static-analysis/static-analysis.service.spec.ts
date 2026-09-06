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
