import { PrismaClient, type AuditAction } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { JwtService } from '@nestjs/jwt';
import type { Request, Response, NextFunction } from 'express';

export interface AuditCtx {
  userId?: number;
  userName?: string;
  ip?: string;
  userAgent?: string;
}

/** Per-request audit context, propagated across async ops by async_hooks. */
export const auditContext = new AsyncLocalStorage<AuditCtx | undefined>();

// Don't audit the audit log (infinite recursion guard; also base writes bypass it).
const SKIP = new Set(['AuditLog']);

const accessor = (base: PrismaClient, model: string): any =>
  (base as any)[model.charAt(0).toLowerCase() + model.slice(1)];

async function readOld(base: PrismaClient, model: string, where: any): Promise<any> {
  try {
    return await accessor(base, model).findUnique({ where });
  } catch {
    return undefined;
  }
}

// Decimal -> number, Date -> ISO string, so the Json column stores plain data.
function safeJson(v: any): any {
  if (v == null) return undefined;
  return JSON.parse(
    JSON.stringify(v, (_k, x) =>
      x && typeof x === 'object' && (x as any)?.constructor?.name === 'Decimal'
        ? Number(x.toString())
        : x,
    ),
  );
}

/**
 * Express middleware that decodes the JWT (if any) and sets the request-scoped
 * audit context for the whole downstream chain. Registered in main.ts on the
 * raw Express instance, so it runs before Nest guards and sees /api/* paths.
 * Runs even for unauthenticated routes — they just get an empty context.
 */
export function auditExpressMiddleware(jwt: JwtService, secret: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    let ctx: AuditCtx = {
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(auth.slice(7), { secret }) as any;
        ctx = { ...ctx, userId: payload.sub, userName: payload.name };
      } catch {
        /* expired/invalid token — proceed with no user; the JwtAuthGuard will reject */
      }
    }
    auditContext.run(ctx, () => next());
  };
}

export function extendWithAudit(base: PrismaClient): PrismaClient {
  async function log(
    action: AuditAction,
    model: string,
    ctx: AuditCtx | undefined,
    old: any,
    val: any,
  ) {
    if (SKIP.has(model)) return;
    const entityId = val?.id ?? old?.id;
    try {
      await base.auditLog.create({
        data: {
          userId: ctx?.userId ?? null,
          userName: ctx?.userName ?? null,
          module: model,
          action,
          entity: model,
          entityId: entityId == null ? null : String(entityId),
          oldValue: old ? safeJson(old) : undefined,
          newValue: val ? safeJson(val) : undefined,
          ip: ctx?.ip ?? null,
          userAgent: ctx?.userAgent ?? null,
        },
      });
    } catch {
      // ponytail: audit failures must never break the business operation.
      // upgrade path: dead-letter to an audit queue + alert if this fires.
    }
  }

  return base.$extends({
    name: 'audit',
    query: {
      $allModels: {
        // ponytail: only single create/update/delete/upsert are audited.
        // createMany/updateMany/deleteMany are NOT — services use single ops.
        async create({ model, args, query }: any) {
          const ctx = auditContext.getStore();
          const result = await query(args);
          await log('CREATE', model, ctx, undefined, result);
          return result;
        },
        async update({ model, args, query }: any) {
          const ctx = auditContext.getStore();
          const old = await readOld(base, model, args.where);
          const result = await query(args);
          await log('UPDATE', model, ctx, old, result);
          return result;
        },
        async delete({ model, args, query }: any) {
          const ctx = auditContext.getStore();
          const old = await readOld(base, model, args.where);
          const result = await query(args);
          await log('DELETE', model, ctx, old, result);
          return result;
        },
        async upsert({ model, args, query }: any) {
          const ctx = auditContext.getStore();
          const old = await readOld(base, model, args.where);
          const result = await query(args);
          await log(old ? 'UPDATE' : 'CREATE', model, ctx, old, result);
          return result;
        },
      },
    },
  }) as unknown as PrismaClient;
}