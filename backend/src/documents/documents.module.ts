import { Module, Controller, Get, Post, Delete, Param, ParseIntPipe, Query, Req, UseInterceptors, Injectable, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Roles } from '../auth/decorators';

const docSelect = {
  id: true, entity: true, entityId: true, fileName: true, originalName: true, mimeType: true, size: true, url: true, uploadedById: true, createdAt: true,
  uploadedBy: { select: { id: true, name: true } },
};

@Injectable()
class DocumentsService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma.audited; }

  list(query: any) {
    const where: any = {};
    if (query.entity) where.entity = query.entity;
    if (query.entityId) where.entityId = Number(query.entityId);
    return this.prisma.document.findMany({ where, select: docSelect, orderBy: { createdAt: 'desc' } });
  }

  // file already saved by multer interceptor; we just record the metadata row.
  create(entity: string, entityId: number, file: any, uploadedById: number) {
    return this.db().document.create({
      data: {
        entity, entityId, fileName: file.filename, originalName: file.originalname,
        mimeType: file.mimetype, size: file.size, url: `/uploads/${file.filename}`, uploadedById,
      }, select: docSelect,
    });
  }

  async remove(id: number) {
    return this.db().document.delete({ where: { id } });
  }
}

@Controller('documents')
class DocumentsController {
  constructor(private svc: DocumentsService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }

  // multipart POST: fields entity, entityId + file=<binary>
  @Post()
  @Roles('ADMIN', 'OPS', 'ACCOUNTS')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads'),
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  }))
  upload(@Req() req: Request, @Query() q: any) {
    const file = (req as any).file;
    if (!file) throw new NotFoundException('No file uploaded');
    const entity = q.entity || 'Project';
    const entityId = Number(q.entityId);
    return this.svc.create(entity, entityId, file, (req as any).user?.id);
  }

  @Delete(':id') @Roles('ADMIN') remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }
}

@Module({ controllers: [DocumentsController], providers: [DocumentsService], imports: [PrismaModule] })
export class DocumentsModule {}