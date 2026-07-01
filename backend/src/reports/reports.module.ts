import { Module, Controller, Get, Query, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';

const D = (x: any) => (x ? new Prisma.Decimal(x) : new Prisma.Decimal(0));

@Injectable()
class ReportsService {
  constructor(private prisma: PrismaService) {}

  // per-project margin: revenue (invoice payments) − salary paid − expenses, per project.
  async projectMargin() {
    const projects = await this.prisma.project.findMany({ select: { id: true, code: true, name: true, clientName: true, contractValue: true } });
    const [invPay, salPay, expPay] = await Promise.all([
      this.prisma.invoicePayment.groupBy({ by: ['invoiceId'], _sum: { amount: true } }),
      this.prisma.salaryPayment.groupBy({ by: ['employeeId'], _sum: { amount: true } }),
      this.prisma.expense.groupBy({ by: ['projectId'], _sum: { paidAmount: true } }),
    ]);
    // map invoiceId -> projectId
    const invoices = await this.prisma.invoice.findMany({ select: { id: true, projectId: true } });
    const invProj = new Map(invoices.map((i) => [i.id, i.projectId]));
    // map employeeId -> primary project (first allocation)
    const allocs = await this.prisma.allocation.findMany({ where: { endDate: null }, select: { employeeId: true, projectId: true } });
    const empProj = new Map(allocs.map((a) => [a.employeeId, a.projectId]));
    const revenueByProj = new Map<number, Prisma.Decimal>();
    for (const g of invPay) { const p = invProj.get(g.invoiceId); if (p) revenueByProj.set(p, (revenueByProj.get(p) ?? D(0)).add(g._sum.amount ?? D(0))); }
    const salaryByProj = new Map<number, Prisma.Decimal>();
    for (const g of salPay) { const p = empProj.get(g.employeeId) ?? null; if (p) salaryByProj.set(p, (salaryByProj.get(p) ?? D(0)).add(g._sum.amount ?? D(0))); }
    const expenseByProj = new Map<number, Prisma.Decimal>();
    for (const g of expPay) if (g.projectId) expenseByProj.set(g.projectId, (expenseByProj.get(g.projectId) ?? D(0)).add(g._sum.paidAmount ?? D(0)));

    return projects.map((p) => {
      const revenue = revenueByProj.get(p.id) ?? D(0);
      const salary = salaryByProj.get(p.id) ?? D(0);
      const expense = expenseByProj.get(p.id) ?? D(0);
      return { ...p, revenue, salary, expense, margin: revenue.sub(salary).sub(expense) };
    });
  }

  // salary register: salary payments in a date range, joined to employee.
  async salaryRegister(query: { from?: string; to?: string }) {
    const where: any = {};
    if (query.from || query.to) where.paidDate = {};
    if (query.from) where.paidDate.gte = new Date(query.from);
    if (query.to) where.paidDate.lte = new Date(query.to);
    const [rows, total] = await Promise.all([
      this.prisma.salaryPayment.findMany({ where, orderBy: { paidDate: 'desc' }, include: { employee: { select: { empCode: true, name: true, designation: true } } } }),
      this.prisma.salaryPayment.aggregate({ _sum: { amount: true }, where }),
    ]);
    return { rows, total: total._sum.amount ?? D(0) };
  }

  // revenue (invoice payments) + expenses in a range, with monthly buckets.
  async cashflow(query: { from?: string; to?: string }) {
    const invWhere: any = {};
    if (query.from || query.to) invWhere.receivedDate = {};
    if (query.from) invWhere.receivedDate.gte = new Date(query.from);
    if (query.to) invWhere.receivedDate.lte = new Date(query.to);
    const expWhere: any = {};
    if (query.from || query.to) expWhere.paidDate = {};
    if (query.from) expWhere.paidDate.gte = new Date(query.from);
    if (query.to) expWhere.paidDate.lte = new Date(query.to);
    const [invoices, expenses, inAgg, outAgg] = await Promise.all([
      this.prisma.invoicePayment.findMany({ where: invWhere, orderBy: { receivedDate: 'desc' }, include: { invoice: { select: { number: true, project: { select: { name: true } } } } } }),
      this.prisma.expense.findMany({ where: { ...expWhere, status: 'PAID' }, orderBy: { paidDate: 'desc' }, include: { project: { select: { name: true } } } }),
      this.prisma.invoicePayment.aggregate({ _sum: { amount: true }, where: invWhere }),
      this.prisma.expense.aggregate({ _sum: { paidAmount: true }, where: { ...expWhere, status: 'PAID' } }),
    ]);
    return { invoices, expenses, in: inAgg._sum.amount ?? D(0), out: outAgg._sum.paidAmount ?? D(0) };
  }
}

@Controller('reports')
class ReportsController {
  constructor(private svc: ReportsService) {}
  @Get('project-margin') margin() { return this.svc.projectMargin(); }
  @Get('salary-register') salary(@Query() q: any) { return this.svc.salaryRegister(q); }
  @Get('cashflow') cashflow(@Query() q: any) { return this.svc.cashflow(q); }
}

@Module({ controllers: [ReportsController], providers: [ReportsService], imports: [PrismaModule] })
export class ReportsModule {}