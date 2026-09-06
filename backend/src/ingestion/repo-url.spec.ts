import { describe, it, expect } from 'vitest';
import { parseRepoUrl } from './repo-url.js';

describe('parseRepoUrl', () => {
  it('deja pasar una URL de clone normal sin cambios', () => {
    expect(parseRepoUrl('https://github.com/devatunes/assessment-cloud')).toEqual({
      cloneUrl: 'https://github.com/devatunes/assessment-cloud',
    });
  });

  it('separa repo y rama de una URL /tree/<rama> copiada del navegador', () => {
    expect(parseRepoUrl('https://github.com/devatunes/assessment-cloud/tree/feature/init')).toEqual({
      cloneUrl: 'https://github.com/devatunes/assessment-cloud',
      branch: 'feature/init',
    });
  });

  it('ignora una barra final', () => {
    expect(parseRepoUrl('https://github.com/devatunes/assessment-cloud/')).toEqual({
      cloneUrl: 'https://github.com/devatunes/assessment-cloud',
    });
  });

  it('no toca URLs de otros hosts (comportamiento anterior: clona la rama default)', () => {
    expect(parseRepoUrl('https://gitlab.com/user/repo/-/tree/main')).toEqual({
      cloneUrl: 'https://gitlab.com/user/repo/-/tree/main',
    });
  });
});
