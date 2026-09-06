export interface ParsedRepoUrl {
  cloneUrl: string;
  branch?: string;
}

/**
 * Acepta tanto la URL de clone real ("https://github.com/user/repo") como la
 * URL que se copia de la barra del navegador al mirar una rama
 * ("https://github.com/user/repo/tree/feature/init") — `git clone` no
 * entiende esta última, así que se separa en repo + rama antes de clonar.
 * Solo cubre GitHub por ahora (es el caso real que motivó esto); otros
 * hosts caen al comportamiento anterior (clone de la rama default).
 */
export function parseRepoUrl(rawUrl: string): ParsedRepoUrl {
  const trimmed = rawUrl.replace(/\/+$/, '');
  const treeMatch = trimmed.match(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\/tree\/(.+)$/);

  if (treeMatch) {
    return { cloneUrl: treeMatch[1], branch: decodeURIComponent(treeMatch[2]) };
  }

  return { cloneUrl: trimmed };
}
