import { BadRequestException, Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import { simpleGit } from 'simple-git';
import { mkdtemp, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ClonedRepo } from './ingestion.types.js';
import { parseRepoUrl } from './repo-url.js';

const CLONE_TIMEOUT_MS = 45_000;
const MAX_REPO_SIZE_BYTES = 200 * 1024 * 1024; // 200MB
const BLOCKED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

/**
 * Clona repos públicos de forma acotada: shallow clone, timeout, límite de
 * tamaño y limpieza garantizada del directorio temporal. Nunca se ejecuta
 * nada del contenido clonado — solo se lee su estructura de archivos.
 */
@Injectable()
export class GitCloneService {
  private readonly logger = new Logger(GitCloneService.name);

  async clone(repoUrl: string): Promise<ClonedRepo> {
    this.validateUrl(repoUrl);

    const targetDir = await mkdtemp(join(tmpdir(), `analysis-${randomUUID()}-`));
    const cleanup = async (): Promise<void> => {
      await rm(targetDir, { recursive: true, force: true }).catch((err) =>
        this.logger.warn(`No se pudo limpiar ${targetDir}: ${String(err)}`),
      );
    };

    try {
      const { cloneUrl, branch } = parseRepoUrl(repoUrl);
      const git = simpleGit({ timeout: { block: CLONE_TIMEOUT_MS } });
      const cloneArgs = ['--depth', '1', '--single-branch'];
      if (branch) cloneArgs.push('--branch', branch);
      await git.clone(cloneUrl, targetDir, cloneArgs);

      const size = await this.directorySize(targetDir, MAX_REPO_SIZE_BYTES);
      if (size > MAX_REPO_SIZE_BYTES) {
        throw new PayloadTooLargeException(
          `El repositorio supera el límite de ${MAX_REPO_SIZE_BYTES / 1024 / 1024}MB permitido para el análisis.`,
        );
      }

      return { path: targetDir, cleanup };
    } catch (err) {
      await cleanup();
      if (err instanceof PayloadTooLargeException) throw err;
      throw new BadRequestException(
        `No se pudo clonar el repositorio. Verificá que la URL sea pública y válida. Detalle: ${String(err)}`,
      );
    }
  }

  /** Solo HTTPS a un host público — bloquea localhost/loopback para evitar SSRF hacia la propia red interna. */
  private validateUrl(repoUrl: string): void {
    let parsed: URL;
    try {
      parsed = new URL(repoUrl);
    } catch {
      throw new BadRequestException('URL de repositorio inválida.');
    }

    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Solo se admiten URLs https:// de repositorios públicos.');
    }

    if (BLOCKED_HOSTNAMES.has(parsed.hostname) || parsed.hostname.startsWith('169.254.')) {
      throw new BadRequestException('Host de repositorio no permitido.');
    }
  }

  /** Suma tamaños recorriendo el árbol; corta apenas supera el límite para no gastar tiempo de más. */
  private async directorySize(dir: string, limit: number): Promise<number> {
    let total = 0;

    const walk = async (current: string): Promise<void> => {
      if (total > limit) return;
      const entries = await readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (total > limit) return;
        const fullPath = join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const s = await stat(fullPath);
          total += s.size;
        }
      }
    };

    await walk(dir);
    return total;
  }
}
