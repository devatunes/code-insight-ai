import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  // Prefijo /api: en producción CloudFront enruta /api/* al ALB y todo lo
  // demás a S3, así frontend y backend quedan en el mismo dominio (cero
  // CORS real, sin exponer el ALB por su propio HTTPS).
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
