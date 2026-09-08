import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // CloudFront reenvía el X-Forwarded-For real del visitante (origin
  // request policy "all_viewer"), y el Security Group del ALB solo acepta
  // tráfico desde la prefix list administrada de CloudFront — nadie puede
  // pegarle directo al ALB para falsificar ese header. Sin esto, req.ip
  // devolvería la IP interna del ALB (igual para todo el tráfico) y el
  // RateLimitGuard agruparía a todo el mundo bajo el mismo contador.
  app.set('trust proxy', true);
  app.enableCors();
  // Prefijo /api: en producción CloudFront enruta /api/* al ALB y todo lo
  // demás a S3, así frontend y backend quedan en el mismo dominio (cero
  // CORS real, sin exponer el ALB por su propio HTTPS).
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
