import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useLogger(app.get(Logger));

  // Increase JSON body size limit for bulk import (preserve rawBody for webhook signature verification)
  app.use(
    express.json({
      limit: '5mb',
      verify: (req: express.Request, _res, buf) => {
        (req as express.Request & { rawBody: Buffer }).rawBody = buf;
      },
    }),
  );

  // Enable cookie parsing
  app.use(cookieParser());

  // Enable CORS with credentials support for httpOnly cookies
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin && process.env.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGIN environment variable must be set in production');
  }
  app.enableCors({
    origin: corsOrigin || true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global prefix for API
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('My Finance API')
    .setDescription('Personal finance management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);

  const logger = app.get(Logger);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/docs`);
}

void bootstrap();
