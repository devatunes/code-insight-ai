import { Injectable } from '@nestjs/common';
import { readdir, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  '.angular',
  '.idea',
  '.vscode',
  'coverage',
  'target', // Maven/Gradle build output
  '__pycache__',
  '.venv',
  'venv',
]);

export interface FileTreeEntry {
  path: string; // relativo a la raíz del repo
  name: string;
  extension: string;
}

export interface FileTreeScan {
  files: FileTreeEntry[];
  topLevelFolders: string[];
  filesByExtension: Record<string, number>;
}

/**
 * Recorre el árbol de archivos de un repo clonado, sin abrir ni ejecutar
 * nada — solo lee nombres y rutas. Ignora carpetas de dependencias/build
 * para que los conteos reflejen el código fuente real del proyecto, no
 * artefactos generados.
 */
@Injectable()
export class FileTreeService {
  async scan(rootDir: string, maxFiles = 20_000): Promise<FileTreeScan> {
    const files: FileTreeEntry[] = [];
    const filesByExtension: Record<string, number> = {};
    const topLevelFolders: string[] = [];

    const topEntries = await readdir(rootDir, { withFileTypes: true });
    for (const entry of topEntries) {
      if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        topLevelFolders.push(entry.name);
      }
    }

    const walk = async (dir: string): Promise<void> => {
      if (files.length >= maxFiles) return;

      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles) return;

        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
          await walk(join(dir, entry.name));
          continue;
        }

        if (!entry.isFile()) continue;

        const fullPath = join(dir, entry.name);
        const relativePath = fullPath.slice(rootDir.length + 1);
        const extension = extname(entry.name) || '(sin extensión)';

        files.push({ path: relativePath, name: entry.name, extension });
        filesByExtension[extension] = (filesByExtension[extension] ?? 0) + 1;
      }
    };

    await walk(rootDir);

    return { files, topLevelFolders, filesByExtension };
  }

  /** Confirma que el path exista y sea un directorio antes de escanear. */
  async isDirectory(path: string): Promise<boolean> {
    try {
      const s = await stat(path);
      return s.isDirectory();
    } catch {
      return false;
    }
  }

  fileNameWithoutExtension(path: string): string {
    const name = basename(path);
    const ext = extname(name);
    return ext ? name.slice(0, -ext.length) : name;
  }
}
