import { Module, Controller, Get, Post, Put, Param, ParseIntPipe, Query, Body, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

const expSelect = {
  id: true, date: true, category: true, vendor: true, amount: true, gst: true,
  projectId: true, paidAmount: true, status: true, dueDate: true, paidDate: true,
  remarks: true, createdAt: true, project: { select: { id: true, name: true } },
};

@Injectable()
class ExpensesService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma.audited; }

  async list(query: any) {
    const { category, projectId, status, month } = query;
    const where: any = {};
    if (category) where.category = { contains: category, mode: 'insensitive' };
    if (projectId) where.projectId = Number(projectId);
    if (status) where.status = status;
    if (month) {
      const y = Number(String(month).slice(0, 4)), m = Number(String(month).slice(4, 6));
      where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }
    return this.prisma.expense.findMany({ where, select: expSelect, orderBy: { date: 'desc' } });
  }

  async create(dto: any) {
    return this.db().expense.create({
      data: {
        date: dto.date ? new Date(dto.date) : new Date(),
        category: dto.category, vendor: dto.vendor,
        amount: dto.amount ?? 0, gst: dto.gst ?? 0,
        projectId: dto.projectId ?? null, dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        remarks: dto.remarks, status: 'UNPAID', paidAmount: 0,
      },
      select: expSelect,
    });
  }

  async update(id: number, dto: any) {
    const data: any = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    if (dto.projectId !== undefined) data.projectId = dto.projectId ?? null;
    return this.db().expense.update({ where: { id }, data, select: expSelect });
  }

  // mark fully paid → reduces the cash fund (paidAmount is what flows out)
  async pay(id: number, dto: { paidDate?: string }) {
    const e = await this.prisma.expense.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Expense not found');
    return this.db().expense.update({
      where: { id },
      data: { paidAmount: e.amount, status: 'PAID', paidDate: dto.paidDate ? new Date(dto.paidDate) : new Date() },
      select: expSelect,
    });
  }
}

@Controller('expenses')
class ExpensesController {
  constructor(private svc: ExpensesService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Post() @Roles('ADMIN', 'ACCOUNTS') create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id') @Roles('ADMIN', 'ACCOUNTS') update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.update(id, dto); }
  @Post(':id/pay') @Roles('ADMIN', 'ACCOUNTS') pay(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.pay(id, dto); }
}

@Module({ controllers: [ExpensesController], providers: [ExpensesService], imports: [PrismaModule] })
export class ExpensesModule {}