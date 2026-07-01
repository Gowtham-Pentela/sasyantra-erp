import { Module, Controller, Get, Post, Param, ParseIntPipe, Query, Body, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

@Injectable()
class AllocationsService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma.audited; }

  // currently active allocations (no endDate)
  async list(query: any) {
    const { projectId, employeeId, active = 'true' } = query;
    const where: any = {};
    if (projectId) where.projectId = Number(projectId);
    if (employeeId) where.employeeId = Number(employeeId);
    if (active === 'true') where.endDate = null;
    return this.db().allocation.findMany({
      where,
      include: { employee: { select: { id: true, empCode: true, name: true, designation: true, status: true } }, project: { select: { id: true, name: true, clientName: true } } },
      orderBy: { effectiveDate: 'desc' },
    });
  }

  // assign (or transfer): if employee has an active allocation, end it, then create new
  async assign(dto: { employeeId: number; projectId: number; role?: string; dailyWage?: number; effectiveDate?: string; remarks?: string }) {
    const eff = dto.effectiveDate ? new Date(dto.effectiveDate) : new Date();
    return this.db().$transaction(async (tx: any) => {
      // close any existing open allocation for this employee
      await tx.allocation.updateMany({
        where: { employeeId: dto.employeeId, endDate: null },
        data: { endDate: new Date(eff.getTime() - 86400000) }, // end day before new effective
      });
      return tx.allocation.create({
        data: { employeeId: dto.employeeId, projectId: dto.projectId, role: dto.role, dailyWage: dto.dailyWage ?? 0, effectiveDate: eff, remarks: dto.remarks },
        include: { employee: { select: { id: true, empCode: true, name: true } }, project: { select: { id: true, name: true } } },
      });
    });
  }

  async end(id: number) {
    return this.db().allocation.update({ where: { id }, data: { endDate: new Date() } });
  }

  async history(employeeId: number) {
    return this.prisma.allocation.findMany({
      where: { employeeId },
      include: { project: { select: { id: true, name: true, clientName: true } } },
      orderBy: { effectiveDate: 'desc' },
    });
  }
}

@Controller('allocations')
class AllocationsController {
  constructor(private svc: AllocationsService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Post() @Roles('ADMIN', 'OPS') assign(@Body() dto: any) { return this.svc.assign(dto); }
  @Post(':id/end') @Roles('ADMIN', 'OPS') end(@Param('id', ParseIntPipe) id: number) { return this.svc.end(id); }
  @Get('employee/:employeeId') history(@Param('employeeId', ParseIntPipe) employeeId: number) { return this.svc.history(employeeId); }
}

@Module({ controllers: [AllocationsController], providers: [AllocationsService], imports: [PrismaModule] })
export class AllocationsModule {}