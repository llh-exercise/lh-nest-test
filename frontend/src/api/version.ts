import type {
  VersionEditRow,
  VersionEnabledStatus,
  VersionRecord,
} from '@/types/version';
import request from './request';

/** 将后端状态码转为展示文案 */
export function numberToEnabledStatus(status: number): VersionEnabledStatus {
  return status === 1 ? '已启用' : '未启用';
}

/** 将展示文案转为后端状态码 */
export function enabledStatusToNumber(status: VersionEnabledStatus): number {
  return status === '已启用' ? 1 : 0;
}

/** 后端记录转表格行 */
export function recordToEditRow(record: VersionRecord): VersionEditRow {
  return {
    id: record.id,
    name: record.name,
    enabledStatus: numberToEnabledStatus(record.status),
  };
}

/** 是否为未落库的新增行 */
export function isTempVersionRow(row: VersionEditRow): boolean {
  return row.id.startsWith('temp_');
}

/** 获取版本列表 */
export function fetchVersionList(): Promise<VersionRecord[]> {
  return request.get('/version') as Promise<VersionRecord[]>;
}

/** 新增版本（POST /version） */
export function createVersionRow(row: VersionEditRow): Promise<VersionRecord> {
  return request.post('/version', {
    data: {
      name: row.name.trim(),
      status: enabledStatusToNumber(row.enabledStatus),
    },
  }) as Promise<VersionRecord>;
}

/** 更新版本（PUT /version/:id） */
export function updateVersionRow(row: VersionEditRow): Promise<VersionRecord> {
  return request.put(`/version/${row.id}`, {
    data: {
      name: row.name.trim(),
      status: enabledStatusToNumber(row.enabledStatus),
    },
  }) as Promise<VersionRecord>;
}

/** 启用版本（PUT /version/:id，status=1） */
export function enableVersionRow(row: VersionEditRow): Promise<VersionRecord> {
  return request.put(`/version/${row.id}`, {
    data: {
      name: row.name.trim(),
      status: 1,
    },
  }) as Promise<VersionRecord>;
}

/** 保存版本：无 id 新增，有 id 更新 */
export function saveVersionRow(row: VersionEditRow): Promise<VersionRecord> {
  if (isTempVersionRow(row)) {
    return createVersionRow(row);
  }
  return updateVersionRow(row);
}

/** 删除版本（DELETE /version/:id） */
export function deleteVersionRow(id: string): Promise<void> {
  return request.delete(`/version/${id}`) as Promise<void>;
}
