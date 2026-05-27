/** 明细状态：0 废弃，1 启用 */
export type DetailsStatus = 0 | 1;

/** 明细状态展示文案 */
export type DetailsStatusLabel = '废弃' | '启用';

/** 明细维护表格行 */
export interface DetailsEditRow {
  id: string;
  typeId: string | null;
  code: string;
  projectName: string;
  /** 展示用：启用同 projectName，废弃为 projectName（废弃） */
  label: string;
  workContent: string;
  contractor: string;
  calcRule: string;
  unit: string;
  index: number;
  status: DetailsStatus;
  statusLabel: DetailsStatusLabel;
}

/** 后端明细记录 */
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
  status: DetailsStatus;
  restoreIndex?: number | null;
}

/** 新增明细请求体 */
export interface CreateDetailsPayload {
  typeId: string;
  code: string;
  projectName: string;
  workContent?: string;
  contractor?: string;
  calcRule?: string;
  unit?: string;
  index?: number;
  status?: DetailsStatus;
}

/** 更新明细请求体 */
export interface UpdateDetailsPayload {
  code?: string;
  projectName?: string;
  workContent?: string;
  contractor?: string;
  calcRule?: string;
  unit?: string;
  index?: number;
  status?: DetailsStatus;
}
