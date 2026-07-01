import { Module, Controller, Get, Query, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

@Injectable()
class ActivityService {
  constructor(private prisma: PrismaService) {}
  async list(query: any) {
    const { module, entity, entityId, action, userId, from, to, page = 1, limit = 50 } = query;
    const where: any = {};
    if (module) where.module = module;
    if (entity) where.entity = entity;
    if (entityId) where.entityId = String(entityId);
    if (action) where.action = action;
    if (userId) where.userId = Number(userId);
    if (from || to) where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
    const take = Math.min(Number(limit) || 50, 200);
    const skip = (Number(page) - 1) * take;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page: Number(page), limit: take };
  }
}

@Controller('activity')
@Roles('ADMIN')
class ActivityController {
  constructor(private svc: ActivityService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
}

@Module({ controllers: [ActivityController], providers: [ActivityService], imports: [PrismaModule] })
export class ActivityModule {}