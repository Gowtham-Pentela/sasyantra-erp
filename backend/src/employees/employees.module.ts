import { Module, Controller, Get, Post, Put, Param, ParseIntPipe, Query, Body, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

const empSelect = {
  id: true, empCode: true, name: true, fatherName: true, mobile: true, altMobile: true,
  address: true, dob: true, gender: true, bloodGroup: true, emergencyContact: true,
  aadhar: true, pan: true, bankAccount: true, ifsc: true, upi: true, joiningDate: true,
  skillCategory: true, designation: true, salaryType: true, dailyWage: true,
  monthlySalary: true, pf: true, esi: true, uan: true, photoUrl: true, status: true,
  createdAt: true, updatedAt: true, archivedAt: true,
};

@Injectable()
class EmployeesService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma.audited; }

  async list(query: any) {
    const { q, status, archived = 'false', page = 1, limit = 25 } = query;
    const where: any = {};
    if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { empCode: { contains: q, mode: 'insensitive' } }, { mobile: { contains: q } }];
    if (status) where.status = status;
    if (archived === 'true') where.archivedAt = { not: null };
    else where.archivedAt = null;
    const take = Math.min(Number(limit) || 25, 200);
    const skip = (Number(page) - 1) * take;
    const [data, total] = await Promise.all([
      this.db().employee.findMany({ where, select: empSelect, orderBy: { empCode: 'asc' }, take, skip }),
      this.prisma.employee.count({ where }),
    ]);
    return { data, total, page: Number(page), limit: take };
  }

  async get(id: number) {
    const emp = await this.db().employee.findUnique({ where: { id }, select: empSelect });
    if (!emp) this.notFound();
    return emp;
  }

  async create(dto: any) {
    const count = await this.prisma.employee.count();
    const empCode = `EMP-${String(count + 1).padStart(4, '0')}`;
    return this.db().employee.create({ data: { ...dto, empCode } });
  }

  async update(id: number, dto: any) {
    return this.db().employee.update({ where: { id }, data: dto });
  }

  async archive(id: number) {
    return this.db().employee.update({ where: { id }, data: { archivedAt: new Date(), status: 'LEFT' } });
  }
  async restore(id: number) {
    return this.db().employee.update({ where: { id }, data: { archivedAt: null, status: 'ACTIVE' } });
  }

  async history(id: number) {
    return this.prisma.auditLog.findMany({
      where: { entity: 'Employee', entityId: String(id) },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
  }

  private notFound(): never {
    throw new NotFoundException('Employee not found');
  }
}

@Controller('employees')
class EmployeesController {
  constructor(private svc: EmployeesService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Get(':id') get(@Param('id', ParseIntPipe) id: number) { return this.svc.get(id); }
  @Post() @Roles('ADMIN', 'OPS') create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id') @Roles('ADMIN', 'OPS') update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.update(id, dto); }
  @Post(':id/archive') @Roles('ADMIN', 'OPS') archive(@Param('id', ParseIntPipe) id: number) { return this.svc.archive(id); }
  @Post(':id/restore') @Roles('ADMIN') restore(@Param('id', ParseIntPipe) id: number) { return this.svc.restore(id); }
  @Get(':id/history') history(@Param('id', ParseIntPipe) id: number) { return this.svc.history(id); }
}

@Module({ controllers: [EmployeesController], providers: [EmployeesService], imports: [PrismaModule] })
export class EmployeesModule {}