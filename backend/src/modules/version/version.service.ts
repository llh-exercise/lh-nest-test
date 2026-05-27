import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVersionDataDto } from './dto/create-version.dto';
import { UpdateVersionDataDto } from './dto/update-version.dto';

export interface VersionRecord {
  id: string;
  name: string;
  status: number;
}

@Injectable()
export class VersionService implements OnModuleInit {
  private static readonly TABLE_NAME = 'version';

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureVersionTable();
  }

  /** 启动时检查版本表，不存在则创建 */
  async ensureVersionTable(): Promise<void> {
    const tables = await this.prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = ${VersionService.TABLE_NAME}
    `;

    if (tables.length > 0) {
      return;
    }

    await this.prisma.$executeRaw`
      CREATE TABLE "version" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "status" INTEGER NOT NULL DEFAULT 0
      )
    `;
  }

  /** 生成下一个流水号 id */
  private async generateNextId(): Promise<string> {
    const rows = await this.prisma.version.findMany({
      select: { id: true },
    });

    let max = 0;
    for (const row of rows) {
      const num = Number.parseInt(row.id, 10);
      if (Number.isFinite(num) && num > max) {
        max = num;
      }
    }

    return String(max + 1);
  }

  /** 校验版本名称是否重复 */
  private async assertNameUnique(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const trimmedName = name.trim();
    const duplicate = await this.prisma.version.findFirst({
      where: {
        name: trimmedName,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (duplicate) {
      throw new BadRequestException('版本名称已存在');
    }
  }

  /** 新增版本记录，自动生成流水号 id */
  async create(data: CreateVersionDataDto): Promise<VersionRecord> {
    const status = data.status ?? 0;
    const name = data.name.trim();
    await this.assertNameUnique(name);
    const id = await this.generateNextId();

    return this.prisma.version.create({
      data: {
        id,
        name,
        status,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });
  }

  async findAll(): Promise<VersionRecord[]> {
    return this.prisma.version.findMany({
      select: {
        id: true,
        name: true,
        status: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  /** 更新版本记录 */
  async update(id: string, data: UpdateVersionDataDto): Promise<VersionRecord> {
    const existing = await this.prisma.version.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`版本 ${id} 不存在`);
    }

    const updateData: { name?: string; status?: number } = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      await this.assertNameUnique(name, id);
      updateData.name = name;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    return this.prisma.version.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        status: true,
      },
    });
  }

  /** 删除版本记录 */
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.version.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`版本 ${id} 不存在`);
    }

    await this.prisma.version.delete({
      where: { id },
    });
  }
}
