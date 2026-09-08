import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Rate limit en memoria, por IP, solo para POST /analyses — el único
 * endpoint que dispara un git clone real más una llamada real (con costo)
 * a la API de IA. No hay autenticación en el proyecto (decisión de alcance
 * documentada en el README), así que esta es la única barrera contra un
 * loop automatizado de requests.
 *
 * No usa @nestjs/throttler: su última versión (6.5.0) todavía no declara
 * soporte de peer dependency para @nestjs/common v12 (el que ya usa este
 * proyecto), y no hay ninguna versión publicada que lo resuelva todavía.
 *
 * Ventana fija (no sliding window): el conteo de una IP se reinicia recién
 * cuando pasa WINDOW_MS desde su primera petición registrada. Suficiente
 * para frenar abuso a este volumen — no hace falta un almacén compartido
 * (Redis, etc.) porque hoy corre un solo task de ECS Fargate.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  // Leídas en el constructor (no como consts de módulo) para que los tests
  // puedan configurar process.env antes de instanciar el guard.
  private readonly windowMs = Number(process.env.ANALYSIS_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000);
  private readonly maxRequests = Number(process.env.ANALYSIS_RATE_LIMIT_MAX ?? 5);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip ?? 'unknown';
    const now = Date.now();

    const entry = this.hits.get(ip);

    if (!entry || now > entry.resetAt) {
      this.hits.set(ip, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      throw new HttpException(
        'Límite de análisis alcanzado para esta IP. Probá de nuevo en unos minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count += 1;
    return true;
  }
}
