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

describe('StaticAnalysisService — Django sin requirements.txt (manage.py como señal)', () => {
  let fixtureDir: string;
  const service = new StaticAnalysisService(
    new FileTreeService(),
    new TechDetectorService(),
    new ArchitectureHeuristicsService(),
  );

  beforeAll(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'code-insight-fixture-django-'));
    await writeFile(join(fixtureDir, 'manage.py'), '');
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it('detecta Python + Django por manage.py, sin depender de requirements.txt', async () => {
    const facts = await service.analyze(fixtureDir);
    expect(facts.technologies.some((t) => t.name === 'Python')).toBe(true);
    expect(facts.technologies.some((t) => t.name === 'Django')).toBe(true);
  });
});

describe('StaticAnalysisService — Ruby on Rails (Gemfile)', () => {
  let fixtureDir: string;
  const service = new StaticAnalysisService(
    new FileTreeService(),
    new TechDetectorService(),
    new ArchitectureHeuristicsService(),
  );

  beforeAll(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'code-insight-fixture-rails-'));
    await writeFile(join(fixtureDir, 'Gemfile'), "source 'https://rubygems.org'\ngem 'rails', '~> 7.1'\n");
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it('detecta Ruby + Rails por Gemfile', async () => {
    const facts = await service.analyze(fixtureDir);
    expect(facts.technologies.some((t) => t.name === 'Ruby')).toBe(true);
    expect(facts.technologies.some((t) => t.name === 'Ruby on Rails')).toBe(true);
  });
});

describe('StaticAnalysisService — PHP/Laravel (composer.json)', () => {
  let fixtureDir: string;
  const service = new StaticAnalysisService(
    new FileTreeService(),
    new TechDetectorService(),
    new ArchitectureHeuristicsService(),
  );

  beforeAll(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'code-insight-fixture-laravel-'));
    await writeFile(
      join(fixtureDir, 'composer.json'),
      JSON.stringify({ require: { 'laravel/framework': '^11.0' } }),
    );
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it('detecta PHP + Laravel por composer.json', async () => {
    const facts = await service.analyze(fixtureDir);
    expect(facts.technologies.some((t) => t.name === 'PHP')).toBe(true);
    expect(facts.technologies.some((t) => t.name === 'Laravel')).toBe(true);
  });
});

describe('StaticAnalysisService — Rust y Kotlin como primaryLanguage', () => {
  const service = new StaticAnalysisService(
    new FileTreeService(),
    new TechDetectorService(),
    new ArchitectureHeuristicsService(),
  );
  let rustDir: string;
  let kotlinDir: string;

  beforeAll(async () => {
    rustDir = await mkdtemp(join(tmpdir(), 'code-insight-fixture-rust-'));
    await writeFile(join(rustDir, 'main.rs'), '');

    kotlinDir = await mkdtemp(join(tmpdir(), 'code-insight-fixture-kotlin-'));
    await writeFile(join(kotlinDir, 'Main.kt'), '');
  });

  afterAll(async () => {
    await rm(rustDir, { recursive: true, force: true });
    await rm(kotlinDir, { recursive: true, force: true });
  });

  it('detecta Rust como lenguaje principal por extensión .rs', async () => {
    const facts = await service.analyze(rustDir);
    expect(facts.primaryLanguage).toBe('Rust');
  });

  it('detecta Kotlin como lenguaje principal por extensión .kt', async () => {
    const facts = await service.analyze(kotlinDir);
    expect(facts.primaryLanguage).toBe('Kotlin');
  });
});

describe('ArchitectureHeuristicsService — hints ampliados (Hexagonal con Infrastructure/, Microservicios por sufijo)', () => {
  const heuristics = new ArchitectureHeuristicsService();

  it('detecta Hexagonal con carpeta "Infrastructure" en vez de "adapter" literal', () => {
    const components = [
      { type: 'port', name: 'UserPort.php', path: 'src/Port/UserPort.php' },
    ];
    const hints = heuristics.buildHints(['Infrastructure', 'src'], components);
    expect(hints.some((h) => h.pattern === 'Hexagonal')).toBe(true);
  });

  it('detecta Microservicios por sufijo de nombre de carpeta (customers-service, api-gateway), sin nombre literal "services"', () => {
    const hints = heuristics.buildHints(
      ['customers-service', 'vets-service', 'api-gateway', 'docs'],
      [],
    );
    expect(hints.some((h) => h.pattern === 'Microservicios')).toBe(true);
  });
});
