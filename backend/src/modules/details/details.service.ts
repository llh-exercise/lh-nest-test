import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDetailsDataDto } from './dto/create-details.dto';
import { UpdateDetailsDataDto } from './dto/update-details.dto';

export interface DetailsRecord {
  id: string;
  typeId: string;
  code: string;
  projectName: string;
  workContent: string;
  contractor: string;
  calcRule: string;
  unit: string;
  index: number;
  status: number;
  restoreIndex: number | null;
}

interface DetailsEntity {
  id: string;
  typeId: string;
  code: string;
  projectName: string;
  workContent: string;
  contractor: string;
  calcRule: string;
  unit: string;
  orderIndex: number;
  status: number;
  restoreIndex: number | null;
}

const detailsSelect = {
  id: true,
  typeId: true,
  code: true,
  projectName: true,
  workContent: true,
  contractor: true,
  calcRule: true,
  unit: true,
  orderIndex: true,
  status: true,
  restoreIndex: true,
} as const;

@Injectable()
export class DetailsService implements OnModuleInit {
  private static readonly TABLE_NAME = 'details';

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDetailsTable();
  }

  /** 将数据库实体映射为 API 记录 */
  private toRecord(entity: DetailsEntity): DetailsRecord {
    return {
      id: entity.id,
      typeId: entity.typeId,
      code: entity.code,
      projectName: entity.projectName,
      workContent: entity.workContent,
      contractor: entity.contractor,
      calcRule: entity.calcRule,
      unit: entity.unit,
      index: entity.orderIndex,
      status: entity.status,
      restoreIndex: entity.restoreIndex,
    };
  }

  /** 启动时检查明细表，不存在则创建 */
  async ensureDetailsTable(): Promise<void> {
    const tables = await this.prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = ${DetailsService.TABLE_NAME}
    `;

    if (tables.length > 0) {
      return;
    }

    await this.prisma.$executeRaw`
      CREATE TABLE "details" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "typeId" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "projectName" TEXT NOT NULL,
        "workContent" TEXT NOT NULL DEFAULT '',
        "contractor" TEXT NOT NULL DEFAULT '',
        "calcRule" TEXT NOT NULL DEFAULT '',
        "unit" TEXT NOT NULL DEFAULT '',
        "index" INTEGER NOT NULL DEFAULT 0,
        "status" INTEGER NOT NULL DEFAULT 1,
        "restoreIndex" INTEGER
      )
    `;
  }

  /** 生成下一个流水号 id */
  private async generateNextId(): Promise<string> {
    const rows = await this.prisma.details.findMany({
      select: { id: true },
    });

    let max = 19999;
    for (const row of rows) {
      const num = Number.parseInt(row.id, 10);
      if (Number.isFinite(num) && num > max) {
        max = num;
      }
    }

    return String(max + 1);
  }

  /** 生成同分类下的下一个排序序号 */
  private async generateNextIndex(typeId: string): Promise<number> {
    const rows = await this.prisma.details.findMany({
      where: { typeId },
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

  /** 校验关联分类是否存在 */
  private async assertTypeExists(typeId: string): Promise<void> {
    const type = await this.prisma.types.findUnique({
      where: { id: typeId },
    });

    if (!type) {
      throw new BadRequestException(`分类 ${typeId} 不存在`);
    }
  }

  /** 校验编码在同一分类内是否重复 */
  private async assertCodeUnique(
    typeId: string,
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const trimmedCode = code.trim();
    const duplicate = await this.prisma.details.findFirst({
      where: {
        typeId,
        code: trimmedCode,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (duplicate) {
      throw new BadRequestException('明细编码已存在');
    }
  }

  /** 新增明细记录 */
  async create(data: CreateDetailsDataDto): Promise<DetailsRecord> {
    const typeId = data.typeId.trim();
    const code = data.code.trim();
    const projectName = data.projectName.trim();
    const workContent = data.workContent?.trim() ?? '';
    const contractor = data.contractor?.trim() ?? '';
    const calcRule = data.calcRule?.trim() ?? '';
    const unit = data.unit.trim();
    const status = data.status ?? 1;
    const orderIndex = data.index ?? (await this.generateNextIndex(typeId));

    await this.assertTypeExists(typeId);
    await this.assertCodeUnique(typeId, code);
    const id = await this.generateNextId();

    const entity = await this.prisma.details.create({
      data: {
        id,
        typeId,
        code,
        projectName,
        workContent,
        contractor,
        calcRule,
        unit,
        orderIndex,
        status,
      },
      select: detailsSelect,
    });

    return this.toRecord(entity);
  }

  async findAll(typeId?: string): Promise<DetailsRecord[]> {
    const list = await this.prisma.details.findMany({
      where: typeId ? { typeId } : undefined,
      select: detailsSelect,
      orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
    });

    return list.map((item) => this.toRecord(item));
  }

  /** 更新明细记录 */
  async update(id: string, data: UpdateDetailsDataDto): Promise<DetailsRecord> {
    const existing = await this.prisma.details.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`明细 ${id} 不存在`);
    }

    if (data.status === 0 && existing.status === 1) {
      return this.disable(id);
    }
    if (data.status === 1 && existing.status === 0) {
      return this.enable(id);
    }

    const updateData: {
      code?: string;
      projectName?: string;
      workContent?: string;
      contractor?: string;
      calcRule?: string;
      unit?: string;
      orderIndex?: number;
      status?: number;
    } = {};

    if (data.code !== undefined) {
      const code = data.code.trim();
      await this.assertCodeUnique(existing.typeId, code, id);
      updateData.code = code;
    }
    if (data.projectName !== undefined) {
      updateData.projectName = data.projectName.trim();
    }
    if (data.workContent !== undefined) {
      updateData.workContent = data.workContent.trim();
    }
    if (data.contractor !== undefined) {
      updateData.contractor = data.contractor.trim();
    }
    if (data.calcRule !== undefined) {
      updateData.calcRule = data.calcRule.trim();
    }
    if (data.unit !== undefined) {
      updateData.unit = data.unit.trim();
    }
    if (data.index !== undefined) {
      updateData.orderIndex = data.index;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    const entity = await this.prisma.details.update({
      where: { id },
      data: updateData,
      select: detailsSelect,
    });

    return this.toRecord(entity);
  }

  /** 获取同分类明细（按排序序号升序） */
  private async findSiblings(typeId: string): Promise<DetailsEntity[]> {
    return this.prisma.details.findMany({
      where: { typeId },
      select: detailsSelect,
      orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
    });
  }

  /** 计算移动到同级末尾后的 id 顺序 */
  private buildSiblingOrderMoveToEnd(
    siblings: DetailsEntity[],
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
    siblings: DetailsEntity[],
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
      this.prisma.details.update({
        where: { id },
        data: { orderIndex: index },
      }),
    );
  }

  /** 废弃明细：保存同级位置并移动到同级末尾 */
  async disable(id: string): Promise<DetailsRecord> {
    const existing = await this.prisma.details.findUnique({
      where: { id },
      select: detailsSelect,
    });

    if (!existing) {
      throw new NotFoundException(`明细 ${id} 不存在`);
    }
    if (existing.status === 0) {
      throw new BadRequestException('当前明细已是废弃状态');
    }

    const savedIndex = existing.orderIndex;
    const siblings = await this.findSiblings(existing.typeId);
    const orderedIds = this.buildSiblingOrderMoveToEnd(siblings, id);

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.details.update({
        where: { id },
        data: {
          restoreIndex: savedIndex,
          status: 0,
        },
      }),
      ...this.buildOrderUpdateOps(orderedIds),
    ];
    await this.prisma.$transaction(operations);

    const entity = await this.prisma.details.findUnique({
      where: { id },
      select: detailsSelect,
    });

    if (!entity) {
      throw new NotFoundException(`明细 ${id} 不存在`);
    }

    return this.toRecord(entity);
  }

  /** 启用明细并恢复到废弃前同级位置 */
  async enable(id: string): Promise<DetailsRecord> {
    const existing = await this.prisma.details.findUnique({
      where: { id },
      select: detailsSelect,
    });

    if (!existing) {
      throw new NotFoundException(`明细 ${id} 不存在`);
    }
    if (existing.status === 1) {
      throw new BadRequestException('当前明细已是启用状态');
    }

    const restoreIndex = existing.restoreIndex ?? existing.orderIndex;
    const siblings = await this.findSiblings(existing.typeId);
    const orderedIds = this.buildSiblingOrderRestore(
      siblings,
      id,
      restoreIndex,
    );

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.details.update({
        where: { id },
        data: { status: 1 },
      }),
      ...this.buildOrderUpdateOps(orderedIds),
    ];
    await this.prisma.$transaction(operations);

    const entity = await this.prisma.details.findUnique({
      where: { id },
      select: detailsSelect,
    });

    if (!entity) {
      throw new NotFoundException(`明细 ${id} 不存在`);
    }

    return this.toRecord(entity);
  }

  /** 删除明细记录 */
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.details.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`明细 ${id} 不存在`);
    }

    await this.prisma.details.delete({
      where: { id },
    });
  }

  /** 按分类 id 批量删除明细（分类删除时级联调用） */
  async removeByTypeIds(typeIds: string[]): Promise<void> {
    if (typeIds.length === 0) {
      return;
    }

    await this.prisma.details.deleteMany({
      where: { typeId: { in: typeIds } },
    });
  }
}
