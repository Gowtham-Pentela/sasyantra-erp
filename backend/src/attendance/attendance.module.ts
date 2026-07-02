import { Module, Controller, Get, Put, Post, Query, Body, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

function monthRange(yyyymm: string) {
  const year = Number(yyyymm.slice(0, 4));
  const month = Number(yyyymm.slice(4, 6)); // 1-12
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1); // exclusive
  return { start, end };
}
function dateStr(d: Date) { return d.toISOString().slice(0, 10); }
// local YYYY-MM-DD (avoid UTC shift on joiningDate comparisons)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function weekdays(start: Date, end: Date) {
  const days: Date[] = [];
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0) days.push(new Date(d)); // skip Sunday
  }
  return days;
}

@Injectable()
class AttendanceService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma.audited; }

  // global: all active (non-archived) employees, regardless of project allocation.
  // ponytail: attendance is a per-employee daily fact; project scope was an artificial filter.
  async byMonth(query: { month: string; projectId?: string }) {
    const { start, end } = monthRange(query.month);
    const employees = await this.prisma.employee.findMany({ where: { archivedAt: null }, select: { id: true, empCode: true, name: true, designation: true, joiningDate: true }, orderBy: { empCode: 'asc' } });
    const empIds = employees.map((e: any) => e.id);
    const rows = empIds.length
      ? await this.prisma.attendance.findMany({ where: { employeeId: { in: empIds }, date: { gte: start, lt: end } }, orderBy: { date: 'asc' } })
      : [];
    const attendance: Record<number, Record<string, any>> = {};
    for (const r of rows) (attendance[r.employeeId] ??= {})[dateStr(r.date)] = r;
    return { employees, attendance, days: weekdays(start, end).map((d) => dateStr(d)) };
  }

  async upsert(dto: any) {
    const emp = await this.prisma.employee.findUnique({ where: { id: dto.employeeId }, select: { joiningDate: true } });
    if (!emp) throw new NotFoundException('Employee not found');
    const date = new Date(dto.date);
    if (dto.date < ymd(emp.joiningDate)) throw new BadRequestException('Date is before employee joining date');
    const code: any = dto.code ?? 'P';
    // ponytail: OT hours belong only on OT-coded days; a P/A/HD/... day carries no OT.
    const otHours = code === 'OT' ? Number(dto.otHours ?? 0) : 0;
    return this.db().attendance.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      create: { employeeId: dto.employeeId, date, code, otHours, advance: dto.advance ?? 0, bonus: dto.bonus ?? 0, travel: dto.travel ?? 0, food: dto.food ?? 0, fine: dto.fine ?? 0, otherAllowance: dto.otherAllowance ?? 0, remarks: dto.remarks },
      update: { code, otHours, advance: dto.advance ?? 0, bonus: dto.bonus ?? 0, travel: dto.travel ?? 0, food: dto.food ?? 0, fine: dto.fine ?? 0, otherAllowance: dto.otherAllowance ?? 0, remarks: dto.remarks },
    });
  }

  // bulk-mark all weekdays present for ALL active employees (only where no row exists, and never before joining date).
  // ponytail: loop of upserts (audited). ceiling ~ (#employees × #weekdays); fine for 3 admins,
  // switch to unaudited createMany + a single summary log if throughput matters.
  async bulk(query: { month: string; code?: string }) {
    const { start, end } = monthRange(query.month);
    const code: any = query.code || 'P';
    const employees = await this.prisma.employee.findMany({ where: { archivedAt: null }, select: { id: true, joiningDate: true } });
    let n = 0;
    for (const e of employees) {
      const joinStr = ymd(e.joiningDate);
      for (const d of weekdays(start, end)) {
        if (ymd(d) < joinStr) continue; // before joining date — no attendance
        const existing = await this.prisma.attendance.findUnique({ where: { employeeId_date: { employeeId: e.id, date: d } } });
        if (existing) continue;
        await this.db().attendance.create({ data: { employeeId: e.id, date: d, code } });
        n++;
      }
    }
    return { created: n };
  }
}

@Controller('attendance')
class AttendanceController {
  constructor(private svc: AttendanceService) {}
  @Get() byMonth(@Query() q: any) { return this.svc.byMonth(q); }
  @Put() @Roles('ADMIN', 'OPS', 'ACCOUNTS') upsert(@Body() dto: any) { return this.svc.upsert(dto); }
  @Post('bulk') @Roles('ADMIN', 'OPS') bulk(@Query() q: any) { return this.svc.bulk(q); }
}

@Module({ controllers: [AttendanceController], providers: [AttendanceService], imports: [PrismaModule] })
export class AttendanceModule {}