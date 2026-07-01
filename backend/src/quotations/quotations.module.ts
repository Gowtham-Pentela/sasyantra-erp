import { Module, Controller, Get, Post, Put, Param, ParseIntPipe, Query, Body, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

const D = (x: any) => new Prisma.Decimal(x || 0);
const quoSelect = {
  id: true, number: true, clientId: true, projectId: true, issueDate: true, validTill: true,
  lineItems: true, subtotal: true, gstPercent: true, gstAmount: true, total: true, status: true,
  notes: true, convertedInvoiceId: true, createdAt: true,
  client: { select: { id: true, name: true } }, project: { select: { id: true, name: true } },
};

@Injectable()
class QuotationsService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma.audited; }

  async list(query: any) {
    const where: any = {};
    if (query.clientId) where.clientId = Number(query.clientId);
    if (query.status) where.status = query.status;
    return this.prisma.quotation.findMany({ where, select: quoSelect, orderBy: { createdAt: 'desc' } });
  }
  get(id: number) { return this.prisma.quotation.findUnique({ where: { id }, select: quoSelect }); }

  // dto: { clientId, projectId?, issueDate?, validTill?, lineItems:[{desc,qty,rate}], gstPercent, notes? }
  // computes amount per line + subtotal + gstAmount + total. auto QUO-####.
  async create(dto: any) {
    const count = await this.prisma.quotation.count();
    const number = `QUO-${String(count + 1).padStart(4, '0')}`;
    const lineItems = (dto.lineItems ?? []).map((l: any) => ({ desc: l.desc || '', qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, amount: (Number(l.qty) || 0) * (Number(l.rate) || 0) }));
    const subtotal = lineItems.reduce((s: number, l: any) => s + l.amount, 0);
    const gstPercent = Number(dto.gstPercent) || 0;
    const gstAmount = +(subtotal * gstPercent / 100).toFixed(2);
    const total = +(subtotal + gstAmount).toFixed(2);
    return this.db().quotation.create({
      data: {
        number, clientId: Number(dto.clientId), projectId: dto.projectId ? Number(dto.projectId) : null,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        validTill: dto.validTill ? new Date(dto.validTill) : null,
        lineItems, subtotal, gstPercent, gstAmount, total, notes: dto.notes, status: 'DRAFT',
      }, select: quoSelect,
    });
  }

  async update(id: number, dto: any) {
    const data: any = {};
    if (dto.clientId) data.clientId = Number(dto.clientId);
    if (dto.projectId !== undefined) data.projectId = dto.projectId ? Number(dto.projectId) : null;
    if (dto.issueDate) data.issueDate = new Date(dto.issueDate);
    if (dto.validTill) data.validTill = dto.validTill ? new Date(dto.validTill) : null;
    if (dto.status) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.lineItems) {
      const lineItems = dto.lineItems.map((l: any) => ({ desc: l.desc || '', qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, amount: (Number(l.qty) || 0) * (Number(l.rate) || 0) }));
      data.lineItems = lineItems;
      data.subtotal = lineItems.reduce((s: number, l: any) => s + l.amount, 0);
      data.gstPercent = Number(dto.gstPercent ?? 0);
      data.gstAmount = +(data.subtotal * data.gstPercent / 100).toFixed(2);
      data.total = +(data.subtotal + data.gstAmount).toFixed(2);
    } else if (dto.gstPercent !== undefined) {
      const q = await this.prisma.quotation.findUnique({ where: { id } });
      data.gstPercent = Number(dto.gstPercent);
      data.gstAmount = +(((q?.subtotal ?? 0) as number) * data.gstPercent / 100).toFixed(2);
      data.total = +(((q?.subtotal ?? 0) as number) + data.gstAmount).toFixed(2);
    }
    return this.db().quotation.update({ where: { id }, data, select: quoSelect });
  }

  // accept a quotation: set status ACCEPTED + create an Invoice from its lines (links via convertedInvoiceId).
  async accept(id: number) {
    const q = await this.prisma.quotation.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Quotation not found');
    if (q.convertedInvoiceId) return this.prisma.quotation.findUnique({ where: { id }, select: quoSelect });
    const count = await this.prisma.invoice.count();
    const number = `INV-${String(count + 1).padStart(4, '0')}`;
    return this.prisma.audited.$transaction(async (tx: any) => {
      const inv = await tx.invoice.create({
        data: { number, projectId: q.projectId, issueDate: new Date(), subtotal: q.subtotal, gstPercent: q.gstPercent, gstAmount: q.gstAmount, total: q.total, notes: `From ${q.number}` },
      });
      return tx.quotation.update({ where: { id }, data: { status: 'ACCEPTED', convertedInvoiceId: inv.id }, select: quoSelect });
    });
  }
}

@Controller('quotations')
class QuotationsController {
  constructor(private svc: QuotationsService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Get(':id') get(@Param('id', ParseIntPipe) id: number) { return this.svc.get(id); }
  @Post() @Roles('ADMIN', 'OPS', 'ACCOUNTS') create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id') @Roles('ADMIN', 'OPS', 'ACCOUNTS') update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.update(id, dto); }
  @Post(':id/accept') @Roles('ADMIN', 'ACCOUNTS') accept(@Param('id', ParseIntPipe) id: number) { return this.svc.accept(id); }
}

@Module({ controllers: [QuotationsController], providers: [QuotationsService], imports: [PrismaModule] })
export class QuotationsModule {}