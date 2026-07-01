import { Module, Controller, Get, Query, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';

@Injectable()
class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async ledger(query: { from?: string; to?: string }) {
    const where: any = {};
    if (query.from || query.to) where.receivedDate = {};
    if (query.from) where.receivedDate.gte = new Date(query.from);
    if (query.to) where.receivedDate.lte = new Date(query.to);
    const sWhere: any = {};
    if (query.from || query.to) sWhere.paidDate = {};
    if (query.from) sWhere.paidDate.gte = new Date(query.from);
    if (query.to) sWhere.paidDate.lte = new Date(query.to);

    const [invoicePayments, salaryPayments, inAgg, outAgg] = await Promise.all([
      this.prisma.invoicePayment.findMany({
        where, orderBy: { receivedDate: 'desc' }, take: 200,
        include: { invoice: { select: { number: true, project: { select: { name: true } } } } },
      }),
      this.prisma.salaryPayment.findMany({
        where: sWhere, orderBy: { paidDate: 'desc' }, take: 200,
        include: { employee: { select: { empCode: true, name: true } } },
      }),
      this.prisma.invoicePayment.aggregate({ _sum: { amount: true }, where }),
      this.prisma.salaryPayment.aggregate({ _sum: { amount: true }, where: sWhere }),
    ]);
    return {
      invoicePayments,
      salaryPayments,
      totals: { in: inAgg._sum.amount ?? new Prisma.Decimal(0), out: outAgg._sum.amount ?? new Prisma.Decimal(0) },
    };
  }
}

@Controller('payments')
class PaymentsController {
  constructor(private svc: PaymentsService) {}
  @Get() ledger(@Query() q: any) { return this.svc.ledger(q); }
}

@Module({ controllers: [PaymentsController], providers: [PaymentsService], imports: [PrismaModule] })
export class PaymentsModule {}