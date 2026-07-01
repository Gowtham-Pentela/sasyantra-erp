import { Module, Controller, Get, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AttendanceCode } from '@prisma/client';

const PAID_TODAY: AttendanceCode[] = ['P', 'OT', 'NS', 'DS', 'TR', 'HD'];

@Injectable()
class DashboardService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    const yyyymm = Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const renewalCutoff = new Date(now.getTime() + 30 * 86400000);

    const [activeProjects, totalEmployees, presentToday, renewalSoon, advancesMonth, projects, payrollRows] = await Promise.all([
      this.prisma.project.count({ where: { status: 'ACTIVE' } }),
      this.prisma.employee.count({ where: { archivedAt: null, status: 'ACTIVE' } }),
      this.prisma.attendance.groupBy({ by: ['employeeId'], where: { date: { gte: new Date(now.toDateString()), lt: new Date(now.toDateString() + ' 23:59:59') }, code: { in: PAID_TODAY } } }).then((g) => g.length),
      this.prisma.project.count({ where: { status: 'ACTIVE', endDate: { gte: now, lte: renewalCutoff } } }),
      this.prisma.attendance.aggregate({ _sum: { advance: true }, where: { date: { gte: monthStart } } }),
      this.prisma.project.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, code: true, name: true, clientName: true, status: true, contractValue: true, gstPercent: true, startDate: true, endDate: true, _count: { select: { allocations: { where: { endDate: null } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payroll.aggregate({ _sum: { net: true, employerCost: true }, where: { month: yyyymm } }),
    ]);

    // projected salary liability if payroll not yet generated for this month.
    // monthlySalary is populated for every employee (daily workers = dailyWage*26 in seed).
    const projected = await this.prisma.employee.aggregate({
      _sum: { monthlySalary: true },
      where: { archivedAt: null, status: 'ACTIVE' },
    });
    const monthlySalaryLiability = payrollRows._sum.net ?? (projected._sum.monthlySalary ?? 0);

    const cards = projects.map((p: any) => ({
      id: p.id, code: p.code, name: p.name, clientName: p.clientName, status: p.status,
      contractValue: p.contractValue, gstPercent: p.gstPercent,
      deployed: p._count.allocations,
    }));

    return {
      kpis: {
        activeProjects,
        totalEmployees,
        presentToday,
        monthlySalaryLiability,
        totalAdvancesGiven: advancesMonth._sum.advance ?? 0,
        upcomingRenewals: renewalSoon,
      },
      // honestly NOT computed this iteration — require the stubbed modules
      pending: {
        monthlyRevenue: 'needs Invoices module',
        monthlyExpenses: 'needs Expenses module',
        grossProfit: 'needs Invoices + Expenses modules',
        netProfit: 'needs Invoices + Expenses modules',
        outstandingPayments: 'needs Invoices + Payments modules',
        cashInHand: 'needs Payments + Expenses modules',
        overdueInvoices: 'needs Invoices module',
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