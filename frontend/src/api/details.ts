import type {
  CreateDetailsPayload,
  DetailsEditRow,
  DetailsRecord,
  DetailsStatus,
  DetailsStatusLabel,
  UpdateDetailsPayload,
} from '@/types/details';
import request from './request';

/** 将后端状态码转为展示文案 */
export function numberToDetailsStatusLabel(
  status: DetailsStatus,
): DetailsStatusLabel {
  return status === 1 ? '启用' : '废弃';
}

/** 生成展示 label：启用仅显示 projectName，废弃显示 projectName（废弃） */
export function buildRowLabel(row: {
  name: string;
  statusLabel: DetailsStatusLabel;
}): string {
  const name = row.name.trim();
  if (row.statusLabel === '启用') {
    return name;
  }
  return name ? `${name}（${row.statusLabel}）` : `（${row.statusLabel}）`;
}

/** 同步行 label */
export function applyRowLabel(row: DetailsEditRow): DetailsEditRow {
  row.label = buildRowLabel({
    name: row.projectName,
    statusLabel: row.statusLabel,
  });
  return row;
}

/** 后端记录转表格行 */
export function recordToEditRow(record: DetailsRecord): DetailsEditRow {
  return applyRowLabel({
    id: record.id,
    typeId: record.typeId,
    code: record.code,
    projectName: record.projectName,
    label: '',
    workContent: record.workContent,
    contractor: record.contractor,
    calcRule: record.calcRule,
    unit: record.unit,
    index: record.index,
    status: record.status,
    statusLabel: numberToDetailsStatusLabel(record.status),
  });
}

/** 是否为未落库的新增行 */
export function isTempDetailsRow(row: DetailsEditRow): boolean {
  return row.id.startsWith('temp_');
}

/** 表格行转新增请求体 */
export function editRowToCreatePayload(row: DetailsEditRow): CreateDetailsPayload {
  if (!row.typeId) {
    throw new Error('缺少关联分类标识');
  }
  return {
    typeId: row.typeId,
    code: row.code.trim(),
    projectName: row.projectName.trim(),
    workContent: row.workContent.trim(),
    contractor: row.contractor.trim(),
    calcRule: row.calcRule.trim(),
    unit: row.unit.trim(),
    index: row.index,
    status: row.status,
  };
}

/** 表格行转更新请求体 */
export function editRowToUpdatePayload(row: DetailsEditRow): UpdateDetailsPayload {
  return {
    code: row.code.trim(),
    projectName: row.projectName.trim(),
    workContent: row.workContent.trim(),
    contractor: row.contractor.trim(),
    calcRule: row.calcRule.trim(),
    unit: row.unit.trim(),
    index: row.index,
    status: row.status,
  };
}

/** 获取明细列表（GET /details） */
export function fetchDetailsList(typeId: string): Promise<DetailsRecord[]> {
  return request.get('/details', {
    params: { typeId },
  }) as Promise<DetailsRecord[]>;
}

/** 新增明细（POST /details） */
export function createDetailsRow(row: DetailsEditRow): Promise<DetailsRecord> {
  return request.post('/details', {
    data: editRowToCreatePayload(row),
  }) as Promise<DetailsRecord>;
}

/** 更新明细（PUT /details/:id） */
export function updateDetailsRow(row: DetailsEditRow): Promise<DetailsRecord> {
  return request.put(`/details/${row.id}`, {
    data: editRowToUpdatePayload(row),
  }) as Promise<DetailsRecord>;
}

/** 更新明细状态（PUT /details/:id） */
export function updateDetailsStatus(
  id: string,
  status: DetailsStatus,
): Promise<DetailsRecord> {
  return request.put(`/details/${id}`, {
    data: { status },
  }) as Promise<DetailsRecord>;
}

/** 更新明细排序（PUT /details/:id） */
export function updateDetailsIndex(
  id: string,
  index: number,
): Promise<DetailsRecord> {
  return request.put(`/details/${id}`, {
    data: { index },
  }) as Promise<DetailsRecord>;
}

/** 交换两条同级明细的排序序号 */
export async function swapDetailsIndex(
  source: DetailsEditRow,
  target: DetailsEditRow,
): Promise<void> {
  const sourceIndex = source.index;
  const targetIndex = target.index;

  const sourceRecord = await updateDetailsIndex(source.id, targetIndex);
  const targetRecord = await updateDetailsIndex(target.id, sourceIndex);

  Object.assign(source, recordToEditRow(sourceRecord));
  Object.assign(target, recordToEditRow(targetRecord));
}

/** 保存明细：无真实 id 新增，有 id 更新 */
export function saveDetailsRow(row: DetailsEditRow): Promise<DetailsRecord> {
  if (isTempDetailsRow(row)) {
    return createDetailsRow(row);
  }
  return updateDetailsRow(row);
}

/** 删除明细（DELETE /details/:id） */
export function deleteDetailsRow(id: string): Promise<void> {
  return request.delete(`/details/${id}`) as Promise<void>;
}
