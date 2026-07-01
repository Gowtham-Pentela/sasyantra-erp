import { Module, Controller, Get, Post, Put, Delete, Param, ParseIntPipe, Body, Req, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

const userSelect = { id: true, email: true, name: true, role: true, createdAt: true };

@Injectable()
class UsersService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma.audited; }

  list() { return this.prisma.user.findMany({ select: userSelect, orderBy: { createdAt: 'asc' } }); }

  async create(dto: { email: string; name: string; password: string; role?: 'ADMIN' | 'OPS' | 'ACCOUNTS' }) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('Email already in use');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.db().user.create({ data: { email: dto.email, name: dto.name, passwordHash, role: dto.role ?? 'ADMIN' }, select: userSelect });
  }

  async update(id: number, dto: { name?: string; role?: string; password?: string }) {
    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.role) data.role = dto.role;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    return this.db().user.update({ where: { id }, data, select: userSelect });
  }

  async remove(id: number, actingUserId: number) {
    if (id === actingUserId) throw new BadRequestException('You cannot delete your own account');
    const admins = await this.prisma.user.count({ where: { role: 'ADMIN' } });
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'ADMIN' && admins <= 1) throw new BadRequestException('Cannot delete the last administrator');
    return this.db().user.delete({ where: { id }, select: userSelect });
  }
}

@Controller('users')
@Roles('ADMIN')
class UsersController {
  constructor(private svc: UsersService) {}
  @Get() list() { return this.svc.list(); }
  @Post() create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.svc.update(id, dto); }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) { return this.svc.remove(id, (req as any).user.id); }
}

@Module({ controllers: [UsersController], providers: [UsersService], imports: [PrismaModule] })
export class UsersModule {}