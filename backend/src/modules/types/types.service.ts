import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTypesDataDto } from './dto/create-types.dto';
import { UpdateTypesDataDto } from './dto/update-types.dto';

export interface TypesRecord {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  note: string;
  index: number;
  status: number;
}

interface TypesEntity {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  note: string;
  orderIndex: number;
  status: number;
}

const typesSelect = {
  id: true,
  parentId: true,
  code: true,
  name: true,
  note: true,
  orderIndex: true,
  status: true,
} as const;

@Injectable()
export class TypesService implements OnModuleInit {
  private static readonly TABLE_NAME = 'types';

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTypesTable();
    await this.ensureTypesColumns();
  }

  /** 将数据库实体映射为 API 记录 */
  private toRecord(entity: TypesEntity): TypesRecord {
    return {
      id: entity.id,
      parentId: entity.parentId,
      code: entity.code,
      name: entity.name,
      note: entity.note,
      index: entity.orderIndex,
      status: entity.status,
    };
  }

  /** 启动时检查分类表，不存在则创建 */
  async ensureTypesTable(): Promise<void> {
    const tables = await this.prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = ${TypesService.TABLE_NAME}
    `;

    if (tables.length > 0) {
      return;
    }

    await this.prisma.$executeRaw`
      CREATE TABLE "types" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "parentId" TEXT,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "note" TEXT NOT NULL DEFAULT '',
        "index" INTEGER NOT NULL DEFAULT 0,
        "status" INTEGER NOT NULL DEFAULT 1
      )
    `;
  }

  /** 启动时为旧表补全 index、status 字段 */
  async ensureTypesColumns(): Promise<void> {
    const columns = await this.prisma.$queryRaw<{ name: string }[]>`
      PRAGMA table_info("types")
    `;
    const columnNames = new Set(columns.map((item) => item.name));

    if (!columnNames.has('index')) {
      await this.prisma.$executeRaw`
        ALTER TABLE "types" ADD COLUMN "index" INTEGER NOT NULL DEFAULT 0
      `;
    }

    if (!columnNames.has('status')) {
      await this.prisma.$executeRaw`
        ALTER TABLE "types" ADD COLUMN "status" INTEGER NOT NULL DEFAULT 1
      `;
    }
  }

  /** 生成下一个流水号 id */
  private async generateNextId(): Promise<string> {
    const rows = await this.prisma.types.findMany({
      select: { id: true },
    });

    let max = 9999;
    for (const row of rows) {
      const num = Number.parseInt(row.id, 10);
      if (Number.isFinite(num) && num > max) {
        max = num;
      }
    }

    return String(max + 1);
  }

  /** 生成同级分类的下一个排序序号 */
  private async generateNextIndex(parentId: string | null): Promise<number> {
    const rows = await this.prisma.types.findMany({
      where: { parentId },
      select: { orderIndex: true },
    });

    let max = -1;
    for (const row of rows) {
      if (row.orderIndex > max) {
        max = row.orderIndex;
      }
    }

    return max + 1;
  }

  /** 校验编码是否重复 */
  private async assertCodeUnique(
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const trimmedCode = code.trim();
    const duplicate = await this.prisma.types.findFirst({
      where: {
        code: trimmedCode,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (duplicate) {
      throw new BadRequestException('分类编码已存在');
    }
  }

  /** 校验父级分类是否存在 */
  private async assertParentExists(parentId: string | null): Promise<void> {
    if (parentId === null) {
      return;
    }

    const parent = await this.prisma.types.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new BadRequestException(`父级分类 ${parentId} 不存在`);
    }
  }

  /** 校验不能将自身设为父级 */
  private assertNotSelfParent(id: string, parentId: string | null): void {
    if (parentId !== null && parentId === id) {
      throw new BadRequestException('不能将自身设为父级分类');
    }
  }

  /** 新增分类记录，自动生成流水号 id 与同级排序序号 */
  async create(data: CreateTypesDataDto): Promise<TypesRecord> {
    const parentId = data.parentId ?? null;
    const code = data.code.trim();
    const name = data.name.trim();
    const note = data.note?.trim() ?? '';
    const status = data.status ?? 1;
    const orderIndex =
      data.index ?? (await this.generateNextIndex(parentId));

    await this.assertParentExists(parentId);
    await this.assertCodeUnique(code);
    const id = await this.generateNextId();

    const entity = await this.prisma.types.create({
      data: {
        id,
        parentId,
        code,
        name,
        note,
        orderIndex,
        status,
      },
      select: typesSelect,
    });

    return this.toRecord(entity);
  }

  async findAll(): Promise<TypesRecord[]> {
    const list = await this.prisma.types.findMany({
      select: typesSelect,
      orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
    });

    return list.map((item) => this.toRecord(item));
  }

  /** 更新分类记录 */
  async update(id: string, data: UpdateTypesDataDto): Promise<TypesRecord> {
    const existing = await this.prisma.types.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`分类 ${id} 不存在`);
    }

    const updateData: {
      parentId?: string | null;
      code?: string;
      name?: string;
      note?: string;
      orderIndex?: number;
      status?: number;
    } = {};

    if (data.parentId !== undefined) {
      this.assertNotSelfParent(id, data.parentId);
      await this.assertParentExists(data.parentId);
      updateData.parentId = data.parentId;
    }
    if (data.code !== undefined) {
      const code = data.code.trim();
      await this.assertCodeUnique(code, id);
      updateData.code = code;
    }
    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.note !== undefined) {
      updateData.note = data.note.trim();
    }
    if (data.index !== undefined) {
      updateData.orderIndex = data.index;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    const entity = await this.prisma.types.update({
      where: { id },
      data: updateData,
      select: typesSelect,
    });

    return this.toRecord(entity);
  }

  /** 删除分类记录 */
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.types.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`分类 ${id} 不存在`);
    }

    const childCount = await this.prisma.types.count({
      where: { parentId: id },
    });

    if (childCount > 0) {
      throw new BadRequestException('存在下级分类，无法删除');
    }

    await this.prisma.types.delete({
      where: { id },
    });
  }
}
