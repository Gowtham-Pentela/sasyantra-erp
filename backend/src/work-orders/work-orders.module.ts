import { Module, Controller, Get, Post, Put, Param, ParseIntPipe, Query, Body, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

const woSelect = {
  id: true, number: true, title: true, projectId: true, clientId: true, quotationId: true, scope: true,
  startDate: true, endDate: true, value: true, status: true, createdAt: true,
  project: { select: { id: true, name: true } }, client: { select: { id: true, name: true } }, quotation: { select: { id: true, number: true } },
};

@Injectable()
class WorkOrdersService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma.audited; }

  async list(query: any) {
    const where: any = {};
    if (query.projectId) where.projectId = Number(query.projectId);
    if (query.status) where.status = query.status;
    return this.prisma.workOrder.findMany({ where, select: woSelect, orderBy: { createdAt: 'desc' } });
  }
  get(id: number) { return this.prisma.workOrder.findUnique({ where: { id }, select: woSelect }); }

  async create(dto: any) {
    const count = await this.prisma.workOrder.count();
    const number = `WO-${String(count + 1).padStart(4, '0')}`;
    return this.db().workOrder.create({
      data: {
        number, title: dto.title, projectId: Number(dto.projectId),
        clientId: dto.clientId ? Number(dto.clientId) : null, quotationId: dto.quotationId ? Number(dto.quotationId) : null,
        scope: dto.scope, startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        endDate: dto.endDate ? new Date(dto.endDate) : null, value: Number(dto.value) || 0, status: dto.status || 'OPEN',
      }, select: woSelect,
    });
  }
  update(id: number, dto: any) {
    const data: any = {};
    for (const k of ['title', 'scope', 'status']) if (dto[k] !== undefined) data[k] = dto[k];
    if (dto.clientId !== undefined) data.clientId = dto.clientId ? Number(dto.clientId) : null;
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.value !== undefined) data.value = Number(dto.value) || 0;
    return this.db().workOrder.update({ where: { id }, data, select: woSelect });
  }
  setStatus(id: number, status: string) { return this.db().workOrder.update({ where: { id }, data: { status: status as any }, select: woSelect }); }
}

@Controller('work-orders')
class WorkOrdersController {
  constructor(private svc: WorkOrdersService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Get(':id') get(@Param('id', ParseIntPipe) id: number) { return this.svc.get(id); }
  @Post() @Roles('ADMIN', 'OPS') create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id') @Roles('ADMIN', 'OPS') update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.update(id, dto); }
  @Post(':id/status') @Roles('ADMIN', 'OPS') status(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.setStatus(id, dto.status); }
}

@Module({ controllers: [WorkOrdersController], providers: [WorkOrdersService], imports: [PrismaModule] })
export class WorkOrdersModule {}