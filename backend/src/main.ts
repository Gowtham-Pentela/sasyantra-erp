import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';
import express from 'express';
import { Prisma } from '@prisma/client';
import { AppModule } from './app.module';
import { auditExpressMiddleware } from './audit/audit.extension';
import { JwtService } from '@nestjs/jwt';

// Prisma.Decimal.toJSON() returns a STRING, so every money field would arrive on the
// frontend as "113100" instead of 113100. Override once, globally -> all JSON emits numbers.
// rupee amounts are far below Number.MAX_SAFE_INTEGER, so safe.
// ponytail: revert to string output if precision >2dp ever matters.
(Prisma.Decimal.prototype as any).toJSON = function () {
  return Number(this.toString());
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');

  // ponytail: no whitelist — DTOs are plain shapes; whitelist would strip undecorated
  // fields (e.g. LoginDto.email). transform on, for query param type coercion.
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const expressApp = app.getHttpAdapter().getInstance() as Express;
  // serve uploaded documents (ponytail: local fs; S3 is the upgrade path)
  expressApp.use('/uploads', express.static('uploads'));

  // request-scoped audit context (decodes JWT, sets AsyncLocalStorage for the chain)
  const jwt = app.get(JwtService);
  expressApp.use(auditExpressMiddleware(jwt, config.get<string>('JWT_SECRET')!));

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`Sasyantra ERP API on http://localhost:${port}/api`);
}
bootstrap();