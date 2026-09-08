import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard.js';

function contextFor(ip: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
    }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  const originalMax = process.env.ANALYSIS_RATE_LIMIT_MAX;
  const originalWindow = process.env.ANALYSIS_RATE_LIMIT_WINDOW_MS;

  beforeEach(() => {
    process.env.ANALYSIS_RATE_LIMIT_MAX = '3';
    process.env.ANALYSIS_RATE_LIMIT_WINDOW_MS = '60000';
  });

  afterEach(() => {
    process.env.ANALYSIS_RATE_LIMIT_MAX = originalMax;
    process.env.ANALYSIS_RATE_LIMIT_WINDOW_MS = originalWindow;
  });

  it('permite peticiones dentro del límite', () => {
    const guard = new RateLimitGuard();
    const context = contextFor('1.2.3.4');

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('bloquea con 429 al superar el límite para la misma IP', () => {
    const guard = new RateLimitGuard();
    const context = contextFor('1.2.3.4');

    guard.canActivate(context);
    guard.canActivate(context);
    guard.canActivate(context);

    expect(() => guard.canActivate(context)).toThrow(HttpException);
    try {
      guard.canActivate(context);
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(429);
    }
  });

  it('cuenta cada IP por separado', () => {
    const guard = new RateLimitGuard();

    guard.canActivate(contextFor('1.1.1.1'));
    guard.canActivate(contextFor('1.1.1.1'));
    guard.canActivate(contextFor('1.1.1.1'));

    // otra IP no está afectada por el límite de la primera
    expect(guard.canActivate(contextFor('2.2.2.2'))).toBe(true);
  });

  it('resetea el conteo pasada la ventana de tiempo', () => {
    process.env.ANALYSIS_RATE_LIMIT_WINDOW_MS = '10';
    const guard = new RateLimitGuard();
    const context = contextFor('3.3.3.3');

    guard.canActivate(context);
    guard.canActivate(context);
    guard.canActivate(context);
    expect(() => guard.canActivate(context)).toThrow(HttpException);

    return new Promise((resolve) => {
      setTimeout(() => {
        expect(guard.canActivate(context)).toBe(true);
        resolve(undefined);
      }, 20);
    });
  });
});
