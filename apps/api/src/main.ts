import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { SanitizeInputPipe } from './common/pipes/sanitize-input.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 4000);
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') ?? [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3005',
    'http://127.0.0.1:3005'
  ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true
  });
  app.useGlobalPipes(
    new SanitizeInputPipe(),
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  await app.listen(port);
}

void bootstrap();
