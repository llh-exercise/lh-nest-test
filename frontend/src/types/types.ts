/** 分类状态：0 废弃，1 启用 */
export type TypesStatus = 0 | 1;

/** 分类状态展示文案 */
export type TypesStatusLabel = '废弃' | '启用';

/** 分类维护表格行 */
export interface TypesEditRow {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  /** 展示用：启用同 name，废弃为 name（废弃） */
  label: string;
  note: string;
  index: number;
  status: TypesStatus;
  statusLabel: TypesStatusLabel;
}

/** 后端分类记录 */
export interface TypesRecord {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  note: string;
  index: number;
  status: TypesStatus;
}

/** 新增分类请求体 */
export interface CreateTypesPayload {
  parentId?: string | null;
  code: string;
  name: string;
  note?: string;
  index?: number;
  status?: TypesStatus;
}

/** 更新分类请求体 */
export interface UpdateTypesPayload {
  parentId?: string | null;
  code?: string;
  name?: string;
  note?: string;
  index?: number;
  status?: TypesStatus;
}
