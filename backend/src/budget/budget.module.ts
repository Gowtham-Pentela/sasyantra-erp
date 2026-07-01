import { Module, Controller, Get, Post, Body, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

// available = opening + topups + invoice payments received − expenses paid − salary paid
@Injectable()
class BudgetService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const [entries, invoiceInAgg, expenseOutAgg, salaryOutAgg] = await Promise.all([
      this.prisma.budgetEntry.aggregate({ _sum: { amount: true } }),
      this.prisma.invoicePayment.aggregate({ _sum: { amount: true } }),
      this.prisma.expense.aggregate({ _sum: { paidAmount: true } }),
      this.prisma.salaryPayment.aggregate({ _sum: { amount: true } }),
    ]);
    const opening = await this.prisma.budgetEntry.aggregate({ _sum: { amount: true }, where: { type: 'OPENING' } });
    const topups = await this.prisma.budgetEntry.aggregate({ _sum: { amount: true }, where: { type: 'TOPUP' } });

    const available = (entries._sum.amount ?? new Prisma.Decimal(0))
      .add(invoiceInAgg._sum.amount ?? new Prisma.Decimal(0))
      .sub(expenseOutAgg._sum.paidAmount ?? new Prisma.Decimal(0))
      .sub(salaryOutAgg._sum.amount ?? new Prisma.Decimal(0));

    const movements = await this.recentMovements();
    return {
      opening: opening._sum.amount ?? 0,
      topups: topups._sum.amount ?? 0,
      invoiceIn: invoiceInAgg._sum.amount ?? 0,
      expenseOut: expenseOutAgg._sum.paidAmount ?? 0,
      salaryOut: salaryOutAgg._sum.amount ?? 0,
      available,
      movements,
    };
  }

  async addEntry(dto: { amount: number; type: 'OPENING' | 'TOPUP'; date?: string; note?: string }) {
    return this.prisma.audited.budgetEntry.create({
      data: { amount: dto.amount, type: dto.type ?? 'TOPUP', date: dto.date ? new Date(dto.date) : new Date(), note: dto.note },
    });
  }

  private async recentMovements() {
    const [budget, inv, exp, sal] = await Promise.all([
      this.prisma.budgetEntry.findMany({ take: 20, orderBy: { date: 'desc' } }),
      this.prisma.invoicePayment.findMany({ take: 20, orderBy: { receivedDate: 'desc' }, include: { invoice: { select: { number: true, project: { select: { name: true } } } } } }),
      this.prisma.expense.findMany({ take: 20, orderBy: { paidDate: 'desc' }, where: { paidAmount: { gt: 0 } }, include: { project: { select: { name: true } } } }),
      this.prisma.salaryPayment.findMany({ take: 20, orderBy: { paidDate: 'desc' }, include: { employee: { select: { name: true, empCode: true } } } }),
    ]);
    const rows = [
      ...budget.map((b) => ({ date: b.date, direction: 'in', label: `${b.type} budget`, amount: b.amount, ref: b.note })),
      ...inv.map((p) => ({ date: p.receivedDate, direction: 'in', label: `Invoice ${p.invoice.number}${p.invoice.project ? ' · ' + p.invoice.project.name : ''}`, amount: p.amount, ref: p.utr })),
      ...exp.map((e) => ({ date: e.paidDate ?? e.date, direction: 'out', label: `${e.category}${e.project ? ' · ' + e.project.name : ''}`, amount: e.paidAmount, ref: e.vendor })),
      ...sal.map((s) => ({ date: s.paidDate, direction: 'out', label: `Salary · ${s.employee.name}`, amount: s.amount, ref: s.utr })),
    ];
    return rows.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 15);
  }
}

@Controller('budget')
class BudgetController {
  constructor(private svc: BudgetService) {}
  @Get() overview() { return this.svc.overview(); }
  @Post() @Roles('ADMIN') add(@Body() dto: any) { return this.svc.addEntry(dto); }
}

@Module({ controllers: [BudgetController], providers: [BudgetService], imports: [PrismaModule] })
export class BudgetModule {}