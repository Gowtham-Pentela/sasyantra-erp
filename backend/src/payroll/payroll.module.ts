import { Module, Controller, Get, Post, Query, Body, Param, ParseIntPipe, Injectable, NotFoundException, Res, Req } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma, type AttendanceCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';
// ponytail: pdf lib is the one justified dep here — Node stdlib can't produce PDFs and the
// user wants a stored, downloadable payslip (browser-print can't persist a file).
import PDFDocument from 'pdfkit';
import { createWriteStream, statSync } from 'fs';
import { join } from 'path';

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
function monthLabel(yyyymm: number) {
  const s = String(yyyymm);
  return new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
const inr = (n: any) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

@Injectable()
class PayrollService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma.audited; }

  private async computeOne(employee: any, projectId: number | null, allocWage: any, info: ReturnType<typeof monthInfo>) {
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
    // ponytail: PT is a flat slab, but never more than gross — guards daily-wage rows with
    // zero attendance (gross=0) from producing a negative net. Configurable slabs are the upgrade path.
    const professionalTax = gross.gt(0) ? d(PT_FLAT) : d(0);
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

  async generate(body: { month: string; projectId?: number; employeeId?: number }) {
    const info = monthInfo(body.month);
    const save = async (emp: any, projectId: number | null, allocWage: any) => {
      const calc = await this.computeOne(emp, projectId, allocWage, info);
      return this.db().payroll.upsert({
        where: { employeeId_month: { employeeId: calc.employeeId, month: info.month } },
        create: calc, update: calc,
        include: { employee: { select: { id: true, empCode: true, name: true, designation: true } } },
      });
    };
    // individual: generate one employee's payslip from their global attendance + active allocation wage
    if (body.employeeId) {
      const emp = await this.prisma.employee.findUnique({ where: { id: body.employeeId } });
      if (!emp || emp.archivedAt) throw new NotFoundException('Active employee not found');
      const alloc = await this.prisma.allocation.findFirst({ where: { employeeId: emp.id, endDate: null } });
      const rec = await save(emp, body.projectId ?? alloc?.projectId ?? null, alloc?.dailyWage ?? null);
      return { month: info.month, projectId: rec.projectId, count: 1, rows: [rec] };
    }
    if (!body.projectId) throw new NotFoundException('projectId or employeeId is required');
    // active allocations to this project
    const allocs = await this.prisma.allocation.findMany({
      where: { projectId: body.projectId, endDate: null, employee: { archivedAt: null } },
      include: { employee: true },
    });
    const results: any[] = [];
    for (const a of allocs) results.push(await save(a.employee, body.projectId, a.dailyWage));
    return { month: info.month, projectId: body.projectId, count: results.length, rows: results };
  }

  async list(query: { month: string; projectId?: string }) {
    const where: any = { month: Number(query.month) };
    if (query.projectId) where.projectId = Number(query.projectId);
    return this.prisma.payroll.findMany({
      where,
      include: {
        employee: { select: { id: true, empCode: true, name: true, designation: true } },
        salaryPayment: true,
      },
      orderBy: { employee: { empCode: 'asc' } },
    });
  }

  // mark a payroll row paid: create SalaryPayment (drains the cash fund) + set paid flag.
  async pay(id: number, dto: { paidDate?: string; utr?: string; mode?: string; remarks?: string }) {
    const row = await this.prisma.payroll.findUnique({ where: { id }, include: { salaryPayment: true } });
    if (!row) throw new NotFoundException('Payroll row not found');
    if (row.salaryPayment) throw new NotFoundException('Already paid');
    const paidDate = dto.paidDate ? new Date(dto.paidDate) : new Date();
    return this.prisma.audited.$transaction(async (tx: any) => {
      await tx.salaryPayment.create({
        data: { payrollId: row.id, employeeId: row.employeeId, month: row.month, amount: row.net, paidDate, utr: dto.utr, mode: dto.mode ?? 'BANK', remarks: dto.remarks },
      });
      return tx.payroll.update({ where: { id }, data: { paid: true, paidDate }, include: { employee: { select: { empCode: true, name: true } }, salaryPayment: true } });
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

  // Build a branded payslip PDF, persist it under uploads/, and record a Document row
  // (entity='Payroll', entityId=payroll.id) so it's stored, audited, and downloadable.
  private async makePayslipPdf(row: any, employee: any): Promise<{ fileName: string; size: number }> {
    const fileName = `payslip-${employee.empCode}-${row.month}-${Date.now()}.pdf`;
    const path = join(process.cwd(), 'uploads', fileName);
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const ws = createWriteStream(path);
    doc.pipe(ws);
    const line = (label: string, amount: any) => `  ${label.padEnd(28)} ${inr(amount).padStart(12)}`;
    const totalEarnings = Number(row.gross) + Number(row.otAmount) + Number(row.bonus) + Number(row.travel) + Number(row.food) + Number(row.otherAllowance);
    const totalDed = Number(row.advanceRecovery) + Number(row.fine) + Number(row.pf) + Number(row.esi) + Number(row.professionalTax) + Number(row.attendanceDeduction);

    doc.fontSize(16).font('Helvetica-Bold').text('Sasyantra Integrated Systems', { align: 'center' });
    doc.moveDown(0.2).fontSize(12).font('Helvetica').text(`Payslip — ${monthLabel(row.month)}`, { align: 'center' });
    doc.moveDown(0.6).fontSize(10);
    doc.text(`Employee: ${employee.name} (${employee.empCode})`);
    if (employee.designation) doc.text(`Designation: ${employee.designation}`);
    doc.text(`Month: ${row.month}   Working Days: ${row.workingDays}   Present: ${row.presentDays}   OT Hours: ${row.otHours}`);
    doc.text(`Payment Status: ${row.paid ? 'PAID' : 'UNPAID'}`);
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').text('EARNINGS');
    doc.font('Courier').fontSize(10);
    doc.text(line('Gross Pay', row.gross));
    doc.text(line(`OT Amount (${row.otHours} hrs)`, row.otAmount));
    doc.text(line('Bonus', row.bonus));
    doc.text(line('Travel', row.travel));
    doc.text(line('Food', row.food));
    doc.text(line('Other Allowance', row.otherAllowance));
    doc.text('  ' + '-'.repeat(42));
    doc.text(line('Total Earnings', totalEarnings));

    doc.moveDown(0.4).font('Helvetica-Bold').fontSize(10).text('DEDUCTIONS');
    doc.font('Courier').fontSize(10);
    doc.text(line('Advance Recovery', row.advanceRecovery));
    doc.text(line('Fine', row.fine));
    doc.text(line('PF', row.pf));
    doc.text(line('ESI', row.esi));
    doc.text(line('Professional Tax', row.professionalTax));
    doc.text(line('Attendance Deduction', row.attendanceDeduction));
    doc.text('  ' + '-'.repeat(42));
    doc.text(line('Total Deductions', totalDed));

    doc.moveDown(0.6).font('Helvetica-Bold').fontSize(13).text(`NET PAY: Rs. ${inr(row.net)}`, { align: 'right' });
    doc.fontSize(9).font('Helvetica').text(`Employer Cost: Rs. ${inr(row.employerCost)}   |   Generated: ${new Date().toLocaleDateString('en-IN')}`);
    doc.end();
    await new Promise<void>((res, rej) => { ws.on('finish', res); ws.on('error', rej); });
    return { fileName, size: statSync(path).size };
  }

  async payslip(id: number, uploadedById?: number) {
    const row = await this.prisma.payroll.findUnique({ where: { id }, include: { employee: { select: { id: true, empCode: true, name: true, designation: true } } } });
    if (!row) throw new NotFoundException('Payroll row not found');
    const { fileName, size } = await this.makePayslipPdf(row, row.employee);
    return this.db().document.create({
      data: { entity: 'Payroll', entityId: row.id, fileName, originalName: fileName, mimeType: 'application/pdf', size, url: `/uploads/${fileName}`, uploadedById: uploadedById ?? null },
      select: { id: true, fileName: true, url: true, createdAt: true },
    });
  }
}

@Controller('payroll')
class PayrollController {
  constructor(private svc: PayrollService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Get('export') export(@Query() q: any, @Res() res: Response) { return this.svc.csv(q, res); }
  @Post('generate') @Roles('ADMIN', 'ACCOUNTS') generate(@Body() b: any) { return this.svc.generate(b); }
  @Post(':id/pay') @Roles('ADMIN', 'ACCOUNTS') pay(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.pay(id, dto); }
  @Post(':id/payslip') @Roles('ADMIN', 'ACCOUNTS') payslip(@Param('id', ParseIntPipe) id: number, @Req() req: any) { return this.svc.payslip(id, req.user?.id); }
}

@Module({ controllers: [PayrollController], providers: [PayrollService], imports: [PrismaModule] })
export class PayrollModule {}