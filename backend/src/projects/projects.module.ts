import { Module, Controller, Get, Post, Put, Delete, Param, ParseIntPipe, Query, Body, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

const projectSelect = {
  id: true, code: true, name: true, clientName: true, clientGst: true, siteLocation: true,
  mapsUrl: true, startDate: true, endDate: true, billingCycle: true, paymentTerms: true,
  contractValue: true, gstPercent: true, status: true, projectManager: true, createdAt: true,
};

@Injectable()
class ProjectsService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma.audited; }

  async list(query: any) {
    const { q, status } = query;
    const where: any = {};
    if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { clientName: { contains: q, mode: 'insensitive' } }, { code: { contains: q } }];
    if (status) where.status = status;
    return this.db().project.findMany({ where, select: projectSelect, orderBy: { createdAt: 'desc' } });
  }

  async get(id: number) {
    const p = await this.db().project.findUnique({ where: { id }, select: { ...projectSelect, allocations: { include: { employee: { select: { id: true, empCode: true, name: true, designation: true, status: true } } }, orderBy: { effectiveDate: 'desc' } } } });
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }

  async create(dto: any) {
    const count = await this.prisma.project.count();
    return this.db().project.create({ data: { ...dto, code: `PRJ-${String(count + 1).padStart(4, '0')}` } });
  }

  async update(id: number, dto: any) {
    return this.db().project.update({ where: { id }, data: dto });
  }

  async history(id: number) {
    return this.prisma.auditLog.findMany({ where: { entity: 'Project', entityId: String(id) }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  // Delete requires CANCELLED status (forces an explicit cancel step — no accidental
  // deletes of live projects). On delete, every dependent's projectId is nulled so the
  // financial/operational history (expenses, invoices, payroll, quotations, allocations,
  // work orders) survives as orphans; only the Project row is removed.
  // ponytail: updateMany orphaning isn't per-row audited (known limitation, §11 of
  // PROJECT_CONTEXT); the DELETE itself is audited, which captures the event.
  async remove(id: number) {
    const proj = await this.prisma.project.findUnique({ where: { id }, select: { status: true } });
    if (!proj) throw new NotFoundException('Project not found');
    if (proj.status !== 'CANCELLED') throw new BadRequestException('Cancel the project (set status to CANCELLED) before deleting it.');
    return this.prisma.audited.$transaction(async (tx: any) => {
      // orphan every dependent so its history survives; then drop the project row
      await tx.allocation.updateMany({ where: { projectId: id }, data: { projectId: null } });
      await tx.payroll.updateMany({ where: { projectId: id }, data: { projectId: null } });
      await tx.invoice.updateMany({ where: { projectId: id }, data: { projectId: null } });
      await tx.expense.updateMany({ where: { projectId: id }, data: { projectId: null } });
      await tx.quotation.updateMany({ where: { projectId: id }, data: { projectId: null } });
      await tx.workOrder.updateMany({ where: { projectId: id }, data: { projectId: null } });
      await tx.projectProgress.deleteMany({ where: { projectId: id } });
      return tx.project.delete({ where: { id } });
    });
  }

  async listProgress(id: number) {
    return this.prisma.projectProgress.findMany({ where: { projectId: id }, orderBy: { month: 'asc' } });
  }

  async upsertProgress(id: number, dto: any) {
    const percent = Number(dto.percent);
    const month = Number(dto.month);
    if (!Number.isInteger(month) || month < 197001 || month > 999912) throw new BadRequestException('month must be a YYYYMM integer');
    if (Number.isNaN(percent) || percent < 0 || percent > 100) throw new BadRequestException('percent must be between 0 and 100');
    return this.db().projectProgress.upsert({
      where: { projectId_month: { projectId: id, month } },
      create: { projectId: id, month, percent, note: dto.note ?? null },
      update: { percent, note: dto.note ?? null },
    });
  }

  async deleteProgress(id: number, pid: number) {
    return this.db().projectProgress.delete({ where: { id: pid, projectId: id } });
  }
}

@Controller('projects')
class ProjectsController {
  constructor(private svc: ProjectsService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Get(':id') get(@Param('id', ParseIntPipe) id: number) { return this.svc.get(id); }
  @Post() @Roles('ADMIN', 'OPS') create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id') @Roles('ADMIN', 'OPS') update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.update(id, dto); }
  @Delete(':id') @Roles('ADMIN', 'OPS') remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }
  @Get(':id/history') history(@Param('id', ParseIntPipe) id: number) { return this.svc.history(id); }
  @Get(':id/progress') listProgress(@Param('id', ParseIntPipe) id: number) { return this.svc.listProgress(id); }
  @Post(':id/progress') @Roles('ADMIN', 'OPS') upsertProgress(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.upsertProgress(id, dto); }
  @Delete(':id/progress/:pid') @Roles('ADMIN', 'OPS') deleteProgress(@Param('id', ParseIntPipe) id: number, @Param('pid', ParseIntPipe) pid: number) { return this.svc.deleteProgress(id, pid); }
}

@Module({ controllers: [ProjectsController], providers: [ProjectsService], imports: [PrismaModule] })
export class ProjectsModule {}