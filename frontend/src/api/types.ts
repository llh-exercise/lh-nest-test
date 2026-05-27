import type {
  CreateTypesPayload,
  TypesEditRow,
  TypesRecord,
  TypesStatus,
  TypesStatusLabel,
  UpdateTypesPayload,
} from '@/types/types';
import request from './request';

/** 全部行固定 id，仅前端展示用 */
const ALL_ROW_ID = '__all__';

/** 将后端状态码转为展示文案 */
export function numberToTypesStatusLabel(status: TypesStatus): TypesStatusLabel {
  return status === 1 ? '启用' : '废弃';
}

/** 生成展示 label：启用仅显示 name，废弃显示 name（废弃） */
export function buildRowLabel(row: {
  id: string;
  name: string;
  statusLabel: TypesStatusLabel;
}): string {
  if (row.id === ALL_ROW_ID) {
    return row.name;
  }
  const name = row.name.trim();
  if (row.statusLabel === '启用') {
    return name;
  }
  return name ? `${name}（${row.statusLabel}）` : `（${row.statusLabel}）`;
}

/** 同步行 label */
export function applyRowLabel(row: TypesEditRow): TypesEditRow {
  row.label = buildRowLabel(row);
  return row;
}

/** 将展示文案转为后端状态码 */
export function typesStatusLabelToNumber(
  status: TypesStatusLabel,
): TypesStatus {
  return status === '启用' ? 1 : 0;
}

/** 后端记录转表格行 */
export function recordToEditRow(record: TypesRecord): TypesEditRow {
  return applyRowLabel({
    id: record.id,
    versionId: record.versionId,
    parentId: record.parentId,
    code: record.code,
    name: record.name,
    label: '',
    note: record.note,
    index: record.index,
    status: record.status,
    statusLabel: numberToTypesStatusLabel(record.status),
  });
}

/** 是否为未落库的新增行 */
export function isTempTypesRow(row: TypesEditRow): boolean {
  return row.id.startsWith('temp_');
}

/** 表格行转新增请求体 */
export function editRowToCreatePayload(row: TypesEditRow): CreateTypesPayload {
  if (!row.versionId) {
    throw new Error('缺少关联版本标识');
  }
  return {
    versionId: row.versionId,
    parentId: row.parentId,
    code: row.code.trim(),
    name: row.name.trim(),
    note: row.note.trim(),
    index: row.index,
    status: row.status,
  };
}

/** 表格行转更新请求体 */
export function editRowToUpdatePayload(row: TypesEditRow): UpdateTypesPayload {
  return {
    parentId: row.parentId,
    code: row.code.trim(),
    name: row.name.trim(),
    note: row.note.trim(),
    index: row.index,
    status: row.status,
  };
}

/** 获取分类列表（GET /types） */
export function fetchTypesList(versionId: string): Promise<TypesRecord[]> {
  return request.get('/types', {
    params: { versionId },
  }) as Promise<TypesRecord[]>;
}

/** 新增分类（POST /types） */
export function createTypesRow(row: TypesEditRow): Promise<TypesRecord> {
  return request.post('/types', {
    data: editRowToCreatePayload(row),
  }) as Promise<TypesRecord>;
}

/** 更新分类（PUT /types/:id） */
export function updateTypesRow(row: TypesEditRow): Promise<TypesRecord> {
  return request.put(`/types/${row.id}`, {
    data: editRowToUpdatePayload(row),
  }) as Promise<TypesRecord>;
}

/** 更新分类状态（PUT /types/:id） */
export function updateTypesStatus(
  id: string,
  status: TypesStatus,
): Promise<TypesRecord> {
  return request.put(`/types/${id}`, {
    data: { status },
  }) as Promise<TypesRecord>;
}

/** 更新分类排序（PUT /types/:id） */
export function updateTypesIndex(
  id: string,
  index: number,
): Promise<TypesRecord> {
  return request.put(`/types/${id}`, {
    data: { index },
  }) as Promise<TypesRecord>;
}

/** 交换两条同级分类的排序序号 */
export async function swapTypesIndex(
  source: TypesEditRow,
  target: TypesEditRow,
): Promise<void> {
  const sourceIndex = source.index;
  const targetIndex = target.index;

  const sourceRecord = await updateTypesIndex(source.id, targetIndex);
  const targetRecord = await updateTypesIndex(target.id, sourceIndex);

  Object.assign(source, recordToEditRow(sourceRecord));
  Object.assign(target, recordToEditRow(targetRecord));
}

/** 保存分类：无真实 id 新增，有 id 更新 */
export function saveTypesRow(row: TypesEditRow): Promise<TypesRecord> {
  if (isTempTypesRow(row)) {
    return createTypesRow(row);
  }
  return updateTypesRow(row);
}

/** 删除分类（DELETE /types/:id） */
export function deleteTypesRow(id: string): Promise<void> {
  return request.delete(`/types/${id}`) as Promise<void>;
}
