import { Module, Controller, Get, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';

const D = (x: any) => (x ? new Prisma.Decimal(x) : new Prisma.Decimal(0));

// Build last-N month buckets (YYYYMM number + label) ending current month.
// ponytail: no DB time math — bucket client-side from rows.
function months(n: number) {
  const now = new Date();
  const out: { key: number; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`), label: d.toLocaleString('en-IN', { month: 'short' }) });
  }
  return out;
}

@Injectable()
class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // monthly revenue (invoice payments, by receivedDate month) vs expense (paidDate month) vs salary (paidDate month)
  async trends() {
    const buckets = months(12);
    const keys = buckets.map((b) => b.key);
    const minKey = Math.min(...keys);
    const minYm = `${String(minKey).slice(0, 4)}-${String(minKey).slice(4)}-01`;
    const [invPay, expPay, salPay] = await Promise.all([
      this.prisma.invoicePayment.findMany({ where: { receivedDate: { gte: new Date(minYm) } }, select: { amount: true, receivedDate: true } }),
      this.prisma.expense.findMany({ where: { paidDate: { gte: new Date(minYm) }, status: 'PAID' }, select: { paidAmount: true, paidDate: true } }),
      this.prisma.salaryPayment.findMany({ where: { paidDate: { gte: new Date(minYm) } }, select: { amount: true, paidDate: true } }),
    ]);
    const bucket = (rows: any[], valField: string, dateField: string) => {
      const m = new Map<number, number>();
      for (const r of rows) {
        const d = new Date(r[dateField]);
        const key = Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
        m.set(key, (m.get(key) ?? 0) + Number(r[valField] ?? 0));
      }
      return buckets.map((b) => m.get(b.key) ?? 0);
    };
    return {
      labels: buckets.map((b) => b.label),
      revenue: bucket(invPay, 'amount', 'receivedDate'),
      expenses: bucket(expPay, 'paidAmount', 'paidDate'),
      salary: bucket(salPay, 'amount', 'paidDate'),
    };
  }

  // project mix by contract value (pie) + status counts (bar)
  async projectMix() {
    const [byValue, byStatus] = await Promise.all([
      this.prisma.project.findMany({ select: { name: true, contractValue: true } }),
      this.prisma.project.groupBy({ by: ['status'], _count: true }),
    ]);
    return {
      value: byValue.map((p) => ({ name: p.name, value: Number(p.contractValue ?? 0) })),
      status: byStatus.map((s) => ({ status: s.status, count: s._count })),
    };
  }

  // headcount: active vs left vs archived; skill-category distribution
  async headcount() {
    const [total, active, left, bySkill] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.employee.count({ where: { status: 'ACTIVE', archivedAt: null } }),
      this.prisma.employee.count({ where: { status: 'LEFT' } }),
      this.prisma.employee.groupBy({ by: ['skillCategory'], where: { archivedAt: null }, _count: true }),
    ]);
    return { total, active, left, bySkill: bySkill.map((s) => ({ category: s.skillCategory ?? '—', count: s._count })) };
  }

  // attendance utilization: last 30 days, present vs absent ratio
  async utilization() {
    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await this.prisma.attendance.groupBy({ by: ['code'], where: { date: { gte: since } }, _count: true });
    return rows.map((r) => ({ code: r.code, count: r._count }));
  }

  // budget health: current available + components
  async budget() {
    const [openingTopups, invIn, expOut, salOut] = await Promise.all([
      this.prisma.budgetEntry.aggregate({ _sum: { amount: true } }),
      this.prisma.invoicePayment.aggregate({ _sum: { amount: true } }),
      this.prisma.expense.aggregate({ _sum: { paidAmount: true } }),
      this.prisma.salaryPayment.aggregate({ _sum: { amount: true } }),
    ]);
    const available = D(openingTopups._sum.amount).add(D(invIn._sum.amount)).sub(D(expOut._sum.paidAmount)).sub(D(salOut._sum.amount));
    return { openingTopups: openingTopups._sum.amount ?? 0, invoiceIn: invIn._sum.amount ?? 0, expenseOut: expOut._sum.paidAmount ?? 0, salaryOut: salOut._sum.amount ?? 0, available };
  }
}

@Controller('analytics')
class AnalyticsController {
  constructor(private svc: AnalyticsService) {}
  @Get('trends') trends() { return this.svc.trends(); }
  @Get('project-mix') mix() { return this.svc.projectMix(); }
  @Get('headcount') headcount() { return this.svc.headcount(); }
  @Get('utilization') util() { return this.svc.utilization(); }
  @Get('budget') budget() { return this.svc.budget(); }
}

@Module({ controllers: [AnalyticsController], providers: [AnalyticsService], imports: [PrismaModule] })
export class AnalyticsModule {}