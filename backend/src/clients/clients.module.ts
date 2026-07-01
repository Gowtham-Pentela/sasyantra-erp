import { Module, Controller, Get, Post, Put, Delete, Param, ParseIntPipe, Query, Body, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

const clientSelect = {
  id: true, name: true, gst: true, pan: true, address: true, contactName: true,
  contactPhone: true, contactEmail: true, billingCycle: true, paymentTerms: true, createdAt: true,
  _count: { select: { projects: true, quotations: true, workOrders: true } },
};

@Injectable()
class ClientsService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma.audited; }

  async list(query: any) {
    const { q } = query;
    const where: any = {};
    if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { gst: { contains: q, mode: 'insensitive' } }, { contactName: { contains: q, mode: 'insensitive' } }];
    return this.prisma.client.findMany({ where, select: clientSelect, orderBy: { name: 'asc' } });
  }
  get(id: number) {
    return this.db().client.findUnique({ where: { id }, select: { ...clientSelect, _count: undefined, projects: { select: { id: true, code: true, name: true, status: true, contractValue: true } } } });
  }
  create(dto: any) { return this.db().client.create({ data: dto, select: clientSelect }); }
  update(id: number, dto: any) { return this.db().client.update({ where: { id }, data: dto, select: clientSelect }); }
  async remove(id: number) {
    const c = await this.prisma.client.findUnique({ where: { id }, include: { _count: { select: { projects: true } } } });
    if (!c) throw new NotFoundException('Client not found');
    if (c._count.projects) throw new NotFoundException('Client has linked projects; unlink or archive them first');
    return this.db().client.delete({ where: { id }, select: clientSelect });
  }
}

@Controller('clients')
class ClientsController {
  constructor(private svc: ClientsService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Get(':id') get(@Param('id', ParseIntPipe) id: number) { return this.svc.get(id); }
  @Post() @Roles('ADMIN', 'OPS') create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id') @Roles('ADMIN', 'OPS') update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.update(id, dto); }
  @Delete(':id') @Roles('ADMIN') remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }
}

@Module({ controllers: [ClientsController], providers: [ClientsService], imports: [PrismaModule] })
export class ClientsModule {}