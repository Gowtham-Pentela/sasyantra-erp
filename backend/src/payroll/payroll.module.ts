import { Module, Controller, Get, Post, Query, Body, Injectable, NotFoundException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma, type AttendanceCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

// payroll constants — ponytail: flat slabs; move to Settings table when configurable.
const OT_FACTOR = 1.5;
const DAY_HOURS = 8;
const BASIC_RATE = 0.5;
const PF_RATE = 0.12;
const ESI_RATE = 0.0075;
const ESI_EMPLOYER_RATE = 0.0325;
const ESI_CEILING = 21000;
const PT_FLAT = 200;

const d = (x: any) => new Prisma.Decimal(x);
// present-day weight by attendance code
const WEIGHT: Record<string, number> = { P: 1, OT: 1, NS: 1, DS: 1, TR: 1, HD: 0.5, A: 0, LV: 0, WO: 0, HL: 0 };

function monthInfo(yyyymm: string) {
  const year = Number(yyyymm.slice(0, 4));
  const month = Number(yyyymm.slice(4, 6));
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  let workingDays = 0;
  for (let day = new Date(start); day < end; day.setDate(day.getDate() + 1)) if (day.getDay() !== 0) workingDays++;
  return { start, end, month: Number(yyyymm), workingDays };
}

@Injectable()
class PayrollService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma.audited; }

  private async computeOne(employee: any, projectId: number, allocWage: any, info: ReturnType<typeof monthInfo>) {
    const rows = await this.prisma.attendance.findMany({ where: { employeeId: employee.id, date: { gte: info.start, lt: info.end } } });
    const sum = (f: keyof typeof rows[0]) => rows.reduce((s, r) => s.add((r as any)[f] as Prisma.Decimal), d(0));
    let presentDays = d(0);
    for (const r of rows) presentDays = presentDays.add(d(WEIGHT[r.code as string] ?? 0));
    const otHours = sum('otHours');

    const isMonthly = employee.salaryType === 'MONTHLY';
    const dailyRate = isMonthly ? d(employee.monthlySalary).div(d(info.workingDays)) : d(allocWage ?? employee.dailyWage);
    const gross = isMonthly ? d(employee.monthlySalary) : presentDays.mul(dailyRate);
    const attendanceDeduction = isMonthly ? d(info.workingDays).sub(presentDays).mul(dailyRate) : d(0);
    const basic = gross.mul(d(BASIC_RATE));
    const otAmount = otHours.mul(dailyRate).div(d(DAY_HOURS)).mul(d(OT_FACTOR));
    const bonus = sum('bonus'), travel = sum('travel'), food = sum('food'), otherAllowance = sum('otherAllowance');
    const advanceRecovery = sum('advance'), fine = sum('fine');
    const pf = employee.pf ? basic.mul(d(PF_RATE)) : d(0);
    const esi = employee.esi && gross.lte(d(ESI_CEILING)) ? gross.mul(d(ESI_RATE)) : d(0);
    const professionalTax = d(PT_FLAT);
    const net = gross.add(otAmount).add(bonus).add(travel).add(food).add(otherAllowance)
      .sub(advanceRecovery).sub(fine).sub(pf).sub(esi).sub(professionalTax).sub(attendanceDeduction);
    const employerPF = employee.pf ? basic.mul(d(PF_RATE)) : d(0);
    const employerESI = employee.esi && gross.lte(d(ESI_CEILING)) ? gross.mul(d(ESI_EMPLOYER_RATE)) : d(0);
    const employerCost = gross.add(otAmount).add(employerPF).add(employerESI);

    return {
      employeeId: employee.id, projectId, month: info.month,
      workingDays: d(info.workingDays), presentDays, otHours,
      gross, attendanceDeduction, basic, otAmount, bonus, advanceRecovery, travel, food,
      pf, esi, professionalTax, net, employerCost,
    };
  }

  async generate(body: { month: string; projectId: number }) {
    const info = monthInfo(body.month);
    // active allocations to this project during/overlapping the month
    const allocs = await this.prisma.allocation.findMany({
      where: { projectId: body.projectId, endDate: null, employee: { archivedAt: null } },
      include: { employee: true },
    });
    const results: any[] = [];
    for (const a of allocs) {
      const calc = await this.computeOne(a.employee, body.projectId, a.dailyWage, info);
      const rec = await this.db().payroll.upsert({
        where: { employeeId_month: { employeeId: calc.employeeId, month: info.month } },
        create: calc, update: calc,
        include: { employee: { select: { id: true, empCode: true, name: true, designation: true } } },
      });
      results.push(rec);
    }
    return { month: info.month, projectId: body.projectId, count: results.length, rows: results };
  }

  async list(query: { month: string; projectId?: string }) {
    const where: any = { month: Number(query.month) };
    if (query.projectId) where.projectId = Number(query.projectId);
    return this.prisma.payroll.findMany({
      where,
      include: { employee: { select: { id: true, empCode: true, name: true, designation: true } } },
      orderBy: { employee: { empCode: 'asc' } },
    });
  }

  async csv(query: { month: string; projectId?: string }, res: Response) {
    const rows = await this.list(query);
    const cols = ['empCode','name','designation','workingDays','presentDays','otHours','gross','basic','otAmount','bonus','advanceRecovery','travel','food','pf','esi','professionalTax','attendanceDeduction','net','employerCost'];
    const lines = [cols.join(',')];
    for (const r of rows) lines.push(cols.map((c) => (r as any)[c] ?? (r.employee as any)?.[c] ?? '').join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${query.month}.csv"`);
    res.send(lines.join('\n'));
  }
}

@Controller('payroll')
class PayrollController {
  constructor(private svc: PayrollService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Get('export') export(@Query() q: any, @Res() res: Response) { return this.svc.csv(q, res); }
  @Post('generate') @Roles('ADMIN', 'ACCOUNTS') generate(@Body() b: any) { return this.svc.generate(b); }
}

@Module({ controllers: [PayrollController], providers: [PayrollService], imports: [PrismaModule] })
export class PayrollModule {}