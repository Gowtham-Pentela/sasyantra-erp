import { Module, Controller, Get, Post, Param, ParseIntPipe, Query, Body, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

function statusOf(total: Prisma.Decimal, paidSum: Prisma.Decimal | null, dueDate: Date | null): string {
  const paid = paidSum ?? new Prisma.Decimal(0);
  const balance = total.sub(paid);
  if (balance.lte(0)) return 'PAID';
  if (paid.gt(0)) return 'PARTIAL';
  if (dueDate && dueDate < new Date()) return 'OVERDUE';
  return 'SENT';
}

@Injectable()
class InvoicesService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma.audited; }

  async list(query: any) {
    const { projectId, status } = query;
    const where: any = {};
    if (projectId) where.projectId = Number(projectId);
    const invs = await this.prisma.invoice.findMany({
      where,
      include: { project: { select: { id: true, name: true, clientName: true } }, payments: { select: { amount: true } } },
      orderBy: { issueDate: 'desc' },
    });
    const rows = invs.map((i) => {
      const paidSum = i.payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
      const status = statusOf(i.total, paidSum, i.dueDate);
      return { ...i, totalPaid: paidSum, balance: i.total.sub(paidSum), status };
    });
    return status ? rows.filter((r) => r.status === status) : rows;
  }

  async get(id: number) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true, clientName: true } }, payments: { orderBy: { receivedDate: 'desc' } } },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    const paidSum = inv.payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
    return { ...inv, totalPaid: paidSum, balance: inv.total.sub(paidSum), status: statusOf(inv.total, paidSum, inv.dueDate) };
  }

  async create(dto: { projectId?: number; issueDate?: string; dueDate?: string; subtotal: number; gstPercent?: number; notes?: string }) {
    const count = await this.prisma.invoice.count();
    const subtotal = new Prisma.Decimal(dto.subtotal);
    const gstPercent = new Prisma.Decimal(dto.gstPercent ?? 0);
    const gstAmount = subtotal.mul(gstPercent).div(new Prisma.Decimal(100));
    const total = subtotal.add(gstAmount);
    return this.db().invoice.create({
      data: {
        number: `INV-${String(count + 1).padStart(4, '0')}`,
        projectId: dto.projectId ?? null,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        subtotal, gstPercent, gstAmount, total, notes: dto.notes,
      },
      include: { project: { select: { name: true, clientName: true } } },
    });
  }

  async recordPayment(id: number, dto: { amount: number; receivedDate?: string; utr?: string; mode?: string; remarks?: string }) {
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    return this.db().invoicePayment.create({
      data: {
        invoiceId: id,
        amount: dto.amount,
        receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : new Date(),
        utr: dto.utr, mode: (dto.mode ?? 'BANK') as any, remarks: dto.remarks,
      },
      include: { invoice: { select: { number: true } } },
    });
  }
}

@Controller('invoices')
class InvoicesController {
  constructor(private svc: InvoicesService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Get(':id') get(@Param('id', ParseIntPipe) id: number) { return this.svc.get(id); }
  @Post() @Roles('ADMIN', 'ACCOUNTS') create(@Body() dto: any) { return this.svc.create(dto); }
  @Post(':id/payments') @Roles('ADMIN', 'ACCOUNTS') pay(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.recordPayment(id, dto); }
}

@Module({ controllers: [InvoicesController], providers: [InvoicesService], imports: [PrismaModule] })
export class InvoicesModule {}