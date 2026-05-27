import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DetailsService } from '../details/details.service';
import { CreateTypesDataDto } from './dto/create-types.dto';
import { UpdateTypesDataDto } from './dto/update-types.dto';

export interface TypesRecord {
  id: string;
  versionId: string | null;
  parentId: string | null;
  code: string;
  name: string;
  note: string;
  index: number;
  status: number;
  restoreIndex: number | null;
}

interface TypesEntity {
  id: string;
  versionId: string | null;
  parentId: string | null;
  code: string;
  name: string;
  note: string;
  orderIndex: number;
  status: number;
  restoreIndex: number | null;
}

const typesSelect = {
  id: true,
  versionId: true,
  parentId: true,
  code: true,
  name: true,
  note: true,
  orderIndex: true,
  status: true,
  restoreIndex: true,
} as const;

@Injectable()
export class TypesService implements OnModuleInit {
  private static readonly TABLE_NAME = 'types';

  constructor(
    private readonly prisma: PrismaService,
    private readonly detailsService: DetailsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTypesTable();
    await this.ensureTypesColumns();
  }

  /** 将数据库实体映射为 API 记录 */
  private toRecord(entity: TypesEntity): TypesRecord {
    return {
      id: entity.id,
      versionId: entity.versionId,
      parentId: entity.parentId,
      code: entity.code,
      name: entity.name,
      note: entity.note,
      index: entity.orderIndex,
      status: entity.status,
      restoreIndex: entity.restoreIndex,
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
        "versionId" TEXT,
        "parentId" TEXT,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "note" TEXT NOT NULL DEFAULT '',
        "index" INTEGER NOT NULL DEFAULT 0,
        "status" INTEGER NOT NULL DEFAULT 1
      )
    `;
  }

  /** 启动时为旧表补全字段 */
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

    if (!columnNames.has('versionId')) {
      await this.prisma.$executeRaw`
        ALTER TABLE "types" ADD COLUMN "versionId" TEXT
      `;
    }

    if (!columnNames.has('restoreIndex')) {
      await this.prisma.$executeRaw`
        ALTER TABLE "types" ADD COLUMN "restoreIndex" INTEGER
      `;
    }
  }

  /** 校验关联版本是否存在 */
  private async assertVersionExists(versionId: string): Promise<void> {
    const version = await this.prisma.version.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      throw new BadRequestException(`版本 ${versionId} 不存在`);
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
  private async generateNextIndex(
    versionId: string,
    parentId: string | null,
  ): Promise<number> {
    const rows = await this.prisma.types.findMany({
      where: { versionId, parentId },
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

  /** 校验编码在同一版本内是否重复 */
  private async assertCodeUnique(
    versionId: string,
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const trimmedCode = code.trim();
    const duplicate = await this.prisma.types.findFirst({
      where: {
        versionId,
        code: trimmedCode,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (duplicate) {
      throw new BadRequestException('分类编码已存在');
    }
  }

  /** 校验父级分类是否存在且属于同一版本 */
  private async assertParentExists(
    versionId: string,
    parentId: string | null,
  ): Promise<void> {
    if (parentId === null) {
      return;
    }

    const parent = await this.prisma.types.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new BadRequestException(`父级分类 ${parentId} 不存在`);
    }

    if (parent.versionId !== versionId) {
      throw new BadRequestException('父级分类与当前版本不一致');
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
    const versionId = data.versionId.trim();
    const parentId = data.parentId ?? null;
    const code = data.code.trim();
    const name = data.name.trim();
    const note = data.note?.trim() ?? '';
    const status = data.status ?? 1;
    const orderIndex =
      data.index ?? (await this.generateNextIndex(versionId, parentId));

    await this.assertVersionExists(versionId);
    await this.assertParentExists(versionId, parentId);
    await this.assertCodeUnique(versionId, code);
    const id = await this.generateNextId();

    const entity = await this.prisma.types.create({
      data: {
        id,
        versionId,
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

  async findAll(versionId?: string): Promise<TypesRecord[]> {
    const list = await this.prisma.types.findMany({
      where: versionId ? { versionId } : undefined,
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

    if (data.status === 0 && existing.status === 1) {
      return this.disable(id);
    }
    if (data.status === 1 && existing.status === 0) {
      return this.enable(id);
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
      if (existing.versionId) {
        await this.assertParentExists(existing.versionId, data.parentId);
      }
      updateData.parentId = data.parentId;
    }
    if (data.code !== undefined) {
      const code = data.code.trim();
      if (existing.versionId) {
        await this.assertCodeUnique(existing.versionId, code, id);
      }
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

  /** 收集指定分类的全部下级 id（不含自身） */
  private collectDescendantIds(
    parentId: string,
    rows: { id: string; parentId: string | null }[],
  ): string[] {
    const result: string[] = [];
    const collect = (currentParentId: string): void => {
      for (const row of rows) {
        if (row.parentId === currentParentId) {
          result.push(row.id);
          collect(row.id);
        }
      }
    };
    collect(parentId);
    return result;
  }

  /** 获取同级分类（按排序序号升序） */
  private async findSiblings(
    versionId: string,
    parentId: string | null,
  ): Promise<TypesEntity[]> {
    return this.prisma.types.findMany({
      where: { versionId, parentId },
      select: typesSelect,
      orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
    });
  }

  /** 计算移动到同级末尾后的 id 顺序 */
  private buildSiblingOrderMoveToEnd(
    siblings: TypesEntity[],
    targetId: string,
  ): string[] {
    const others = siblings.filter((item) => item.id !== targetId);
    const target = siblings.find((item) => item.id === targetId);
    if (!target) {
      return siblings.map((item) => item.id);
    }
    return [...others.map((item) => item.id), target.id];
  }

  /** 计算恢复到指定同级位置后的 id 顺序 */
  private buildSiblingOrderRestore(
    siblings: TypesEntity[],
    targetId: string,
    restoreIndex: number,
  ): string[] {
    const others = siblings.filter((item) => item.id !== targetId);
    const target = siblings.find((item) => item.id === targetId);
    if (!target) {
      return siblings.map((item) => item.id);
    }
    const position = Math.min(Math.max(restoreIndex, 0), others.length);
    return [
      ...others.slice(0, position).map((item) => item.id),
      target.id,
      ...others.slice(position).map((item) => item.id),
    ];
  }

  /** 构建同级排序更新操作（用于批量事务） */
  private buildOrderUpdateOps(
    orderedIds: string[],
  ): Prisma.PrismaPromise<unknown>[] {
    return orderedIds.map((id, index) =>
      this.prisma.types.update({
        where: { id },
        data: { orderIndex: index },
      }),
    );
  }

  /** 废弃分类：级联废弃子集、保存同级位置并移动到同级末尾 */
  async disable(id: string): Promise<TypesRecord> {
    const existing = await this.prisma.types.findUnique({
      where: { id },
      select: typesSelect,
    });

    if (!existing) {
      throw new NotFoundException(`分类 ${id} 不存在`);
    }
    if (existing.status === 0) {
      throw new BadRequestException('当前分类已是废弃状态');
    }
    if (!existing.versionId) {
      throw new BadRequestException('分类缺少关联版本');
    }

    const rows = await this.prisma.types.findMany({
      select: { id: true, parentId: true },
    });
    const descendantIds = this.collectDescendantIds(id, rows);
    const savedIndex = existing.orderIndex;
    const siblings = await this.findSiblings(
      existing.versionId,
      existing.parentId,
    );
    const orderedIds = this.buildSiblingOrderMoveToEnd(siblings, id);

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.types.update({
        where: { id },
        data: {
          restoreIndex: savedIndex,
          status: 0,
        },
      }),
    ];

    if (descendantIds.length > 0) {
      operations.push(
        this.prisma.types.updateMany({
          where: { id: { in: descendantIds } },
          data: { status: 0 },
        }),
      );
    }

    operations.push(...this.buildOrderUpdateOps(orderedIds));
    await this.prisma.$transaction(operations);

    const entity = await this.prisma.types.findUnique({
      where: { id },
      select: typesSelect,
    });

    if (!entity) {
      throw new NotFoundException(`分类 ${id} 不存在`);
    }

    return this.toRecord(entity);
  }

  /** 启用分类：级联启用子集并恢复到废弃前同级位置 */
  async enable(id: string): Promise<TypesRecord> {
    const existing = await this.prisma.types.findUnique({
      where: { id },
      select: typesSelect,
    });

    if (!existing) {
      throw new NotFoundException(`分类 ${id} 不存在`);
    }
    if (existing.status === 1) {
      throw new BadRequestException('当前分类已是启用状态');
    }
    if (!existing.versionId) {
      throw new BadRequestException('分类缺少关联版本');
    }

    const rows = await this.prisma.types.findMany({
      select: { id: true, parentId: true },
    });
    const descendantIds = this.collectDescendantIds(id, rows);
    const restoreIndex = existing.restoreIndex ?? existing.orderIndex;
    const siblings = await this.findSiblings(
      existing.versionId,
      existing.parentId,
    );
    const orderedIds = this.buildSiblingOrderRestore(
      siblings,
      id,
      restoreIndex,
    );

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.types.updateMany({
        where: { id: { in: [id, ...descendantIds] } },
        data: { status: 1 },
      }),
      ...this.buildOrderUpdateOps(orderedIds),
    ];
    await this.prisma.$transaction(operations);

    const entity = await this.prisma.types.findUnique({
      where: { id },
      select: typesSelect,
    });

    if (!entity) {
      throw new NotFoundException(`分类 ${id} 不存在`);
    }

    return this.toRecord(entity);
  }

  /** 删除分类记录，存在下级时一并删除 */
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.types.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`分类 ${id} 不存在`);
    }

    const rows = await this.prisma.types.findMany({
      select: { id: true, parentId: true },
    });
    const descendantIds = this.collectDescendantIds(id, rows);
    const idsToDelete = [...descendantIds, id];

    await this.detailsService.removeByTypeIds(idsToDelete);
    await this.prisma.types.deleteMany({
      where: { id: { in: idsToDelete } },
    });
  }
}
