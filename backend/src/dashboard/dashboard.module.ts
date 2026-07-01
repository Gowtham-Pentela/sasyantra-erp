import { Module, Controller, Get, Injectable } from '@nestjs/common';
import { Prisma, AttendanceCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';

const PAID_TODAY: AttendanceCode[] = ['P', 'OT', 'NS', 'DS', 'TR', 'HD'];
const D0 = () => new Prisma.Decimal(0);

@Injectable()
class DashboardService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    const yyyymm = Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const renewalCutoff = new Date(now.getTime() + 30 * 86400000);

    const [activeProjects, totalEmployees, presentToday, renewalSoon, advancesMonth, projects, payrollRows,
      budgetAgg, invoiceInAgg, expenseOutAgg, salaryOutAgg,
      revenueAgg, expenseMonthAgg, salaryMonthAgg,
      invoiceTotalAgg, overdueInvs,
    ] = await Promise.all([
      this.prisma.project.count({ where: { status: 'ACTIVE' } }),
      this.prisma.employee.count({ where: { archivedAt: null, status: 'ACTIVE' } }),
      this.prisma.attendance.groupBy({ by: ['employeeId'], where: { date: { gte: new Date(now.toDateString()), lt: new Date(now.toDateString() + ' 23:59:59') }, code: { in: PAID_TODAY } } }).then((g) => g.length),
      this.prisma.project.count({ where: { status: 'ACTIVE', endDate: { gte: now, lte: renewalCutoff } } }),
      this.prisma.attendance.aggregate({ _sum: { advance: true }, where: { date: { gte: monthStart } } }),
      this.prisma.project.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, code: true, name: true, clientName: true, status: true, contractValue: true, gstPercent: true, _count: { select: { allocations: { where: { endDate: null } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payroll.aggregate({ _sum: { net: true, employerCost: true }, where: { month: yyyymm } }),
      // finance
      this.prisma.budgetEntry.aggregate({ _sum: { amount: true } }),
      this.prisma.invoicePayment.aggregate({ _sum: { amount: true } }),
      this.prisma.expense.aggregate({ _sum: { paidAmount: true } }),
      this.prisma.salaryPayment.aggregate({ _sum: { amount: true } }),
      this.prisma.invoice.aggregate({ _sum: { total: true }, where: { issueDate: { gte: monthStart, lt: nextMonth } } }),
      this.prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: monthStart, lt: nextMonth } } }),
      this.prisma.salaryPayment.aggregate({ _sum: { amount: true }, where: { paidDate: { gte: monthStart, lt: nextMonth } } }),
      this.prisma.invoice.aggregate({ _sum: { total: true } }),
      this.prisma.invoice.findMany({ where: { dueDate: { lt: now } }, include: { payments: { select: { amount: true } } } }),
    ]);

    const projected = await this.prisma.employee.aggregate({ _sum: { monthlySalary: true }, where: { archivedAt: null, status: 'ACTIVE' } });
    const monthlySalaryLiability = payrollRows._sum.net ?? (projected._sum.monthlySalary ?? 0);

    const availableBudget = (budgetAgg._sum.amount ?? D0()).add(invoiceInAgg._sum.amount ?? D0()).sub(expenseOutAgg._sum.paidAmount ?? D0()).sub(salaryOutAgg._sum.amount ?? D0());
    const outstandingPayments = (invoiceTotalAgg._sum.total ?? D0()).sub(invoiceInAgg._sum.amount ?? D0());
    const overdueInvoices = overdueInvs.filter((i) => i.payments.reduce((s, p) => s.add(p.amount), D0()).lt(i.total)).length;
    const monthlyRevenue = revenueAgg._sum.total ?? D0();
    const monthlyExpenses = expenseMonthAgg._sum.amount ?? D0();
    const salaryPaidThisMonth = salaryMonthAgg._sum.amount ?? D0();
    const monthlyProfit = monthlyRevenue.sub(monthlyExpenses).sub(salaryPaidThisMonth);

    const cards = projects.map((p: any) => ({
      id: p.id, code: p.code, name: p.name, clientName: p.clientName, status: p.status,
      contractValue: p.contractValue, gstPercent: p.gstPercent, deployed: p._count.allocations,
    }));

    return {
      kpis: {
        activeProjects,
        totalEmployees,
        presentToday,
        monthlySalaryLiability,
        totalAdvancesGiven: advancesMonth._sum.advance ?? 0,
        upcomingRenewals: renewalSoon,
        availableBudget,
        monthlyRevenue,
        monthlyExpenses,
        outstandingPayments,
        overdueInvoices,
        totalPaidToEmployees: salaryOutAgg._sum.amount ?? 0,
        salaryPaidThisMonth,
        monthlyProfit, // indicative: revenue − expenses − salary paid this month
      },
      // still stubbed (need their own modules): Clients/Quotations/Work Orders/Reports/Analytics/Documents
      pending: {
        grossProfit: 'needs Reports module (per-project margin breakdown)',
      },
      projects: cards,
    };
  }
}

@Controller('dashboard')
class DashboardController {
  constructor(private svc: DashboardService) {}
  @Get() overview() { return this.svc.overview(); }
}

@Module({ controllers: [DashboardController], providers: [DashboardService], imports: [PrismaModule] })
export class DashboardModule {}