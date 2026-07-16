import { Module, Controller, Get, Post, Put, Param, ParseIntPipe, Query, Body, Injectable, NotFoundException, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  // revert a mistaken "paid" — back to UNPAID, zero paidAmount, clear paidDate.
  async unpay(id: number) {
    const e = await this.prisma.expense.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Expense not found');
    return this.db().expense.update({ where: { id }, data: { status: 'UNPAID', paidAmount: 0, paidDate: null }, select: expSelect });
  }

  // Bulk import from an Excel/CSV sheet. Columns (case-insensitive): date, category,
  // vendor, amount, gst, project (name) | projectId, dueDate, remarks. category+amount
  // required; the rest optional. project name is resolved to projectId case-insensitively.
  // ponytail: loop of audited creates. ceiling ~ row count; switch to unaudited createMany
  // + one summary log if large imports become common.
  async importExcel(buf: Buffer) {
    const XLSX = require('xlsx');
    const wb = XLSX.read(buf, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new BadRequestException('Sheet has no data');
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null }) as any[];
    if (!rawRows.length) throw new BadRequestException('Sheet is empty');
    const norm = (r: any) => { const o: any = {}; for (const k in r) o[k.toLowerCase().trim()] = r[k]; return o; };
    const rows = rawRows.map(norm);

    const parseDate = (v: any): Date | null => {
      if (!v) return null;
      if (v instanceof Date) return v;
      if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return isNaN(d.getTime()) ? null : d; }
      const s = String(v).trim();
      const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/); // DD-MM-YYYY (Indian)
      if (m) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); const d = new Date(y, Number(m[2]) - 1, Number(m[1])); return isNaN(d.getTime()) ? null : d; }
      const d = new Date(s); return isNaN(d.getTime()) ? null : d;
    };

    const names = new Set<string>();
    for (const r of rows) { const n = r.project; if (n) names.add(String(n).trim()); }
    const nameToId: Record<string, number> = {};
    if (names.size) {
      const found = await this.prisma.project.findMany({ where: { name: { in: [...names], mode: 'insensitive' } }, select: { id: true, name: true } });
      for (const p of found) nameToId[p.name.toLowerCase()] = p.id;
    }

    let created = 0, skipped = 0; const errors: string[] = [];
    for (const [i, r] of rows.entries()) {
      const category = String(r.category ?? '').trim();
      const amount = Number(r.amount ?? 0);
      if (!category || !amount) { skipped++; errors.push(`Row ${i + 2}: missing category or amount`); continue; }
      const projectId = r.projectid ? Number(r.projectid) : (r.project ? nameToId[String(r.project).trim().toLowerCase()] : undefined);
      try {
        await this.db().expense.create({ data: {
          date: parseDate(r.date) ?? new Date(),
          category, vendor: r.vendor ? String(r.vendor).trim() : null,
          amount, gst: Number(r.gst ?? 0),
          projectId: projectId ?? null,
          dueDate: parseDate(r.dueDate),
          remarks: r.remarks ? String(r.remarks).trim() : null,
          status: 'UNPAID', paidAmount: 0,
        }, select: expSelect });
        created++;
      } catch (e: any) { skipped++; errors.push(`Row ${i + 2}: ${e.message}`); }
    }
    return { created, skipped, errors: errors.slice(0, 20) };
  }
}

@Controller('expenses')
class ExpensesController {
  constructor(private svc: ExpensesService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Post() @Roles('ADMIN', 'ACCOUNTS') create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id') @Roles('ADMIN', 'ACCOUNTS') update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.update(id, dto); }
  @Post(':id/pay') @Roles('ADMIN', 'ACCOUNTS') pay(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.pay(id, dto); }
  @Post(':id/unpay') @Roles('ADMIN', 'ACCOUNTS') unpay(@Param('id', ParseIntPipe) id: number) { return this.svc.unpay(id); }
  @Post('import') @Roles('ADMIN', 'ACCOUNTS') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Upload an .xlsx/.xls/.csv file');
    return this.svc.importExcel(file.buffer);
  }
}

@Module({ controllers: [ExpensesController], providers: [ExpensesService], imports: [PrismaModule] })
export class ExpensesModule {}