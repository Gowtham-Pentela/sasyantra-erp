import { Module, Controller, Get, Post, Put, Param, ParseIntPipe, Query, Body, Injectable, NotFoundException } from '@nestjs/common';
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
}

@Controller('projects')
class ProjectsController {
  constructor(private svc: ProjectsService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Get(':id') get(@Param('id', ParseIntPipe) id: number) { return this.svc.get(id); }
  @Post() @Roles('ADMIN', 'OPS') create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id') @Roles('ADMIN', 'OPS') update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.update(id, dto); }
  @Get(':id/history') history(@Param('id', ParseIntPipe) id: number) { return this.svc.history(id); }
}

@Module({ controllers: [ProjectsController], providers: [ProjectsService], imports: [PrismaModule] })
export class ProjectsModule {}