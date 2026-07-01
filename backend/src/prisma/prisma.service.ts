import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { auditContext, extendWithAudit } from '../audit/audit.extension';

// A single base client, extended once with audit hooks.
// The extension is applied here so every module that injects PrismaService
// gets auditing for free; raw base access (seed) bypasses it via direct PrismaClient.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  readonly audited = extendWithAudit(this);

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** run a handler with a request-scoped audit context (user/ip/ua) */
  withContext<T>(ctx: { userId: number; userName: string; ip?: string; userAgent?: string }, fn: () => Promise<T>): Promise<T> {
    return auditContext.run(ctx, fn);
  }
}