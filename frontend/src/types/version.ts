export interface VersionOption {
  id: string;
  label: string;
}

/** 启用状态 */
export type VersionEnabledStatus = '未启用' | '已启用';

/** 版本维护表格行 */
export interface VersionEditRow {
  id: string;
  name: string;
  enabledStatus: VersionEnabledStatus;
}

/** 后端版本记录 */
export interface VersionRecord {
  id: string;
  name: string;
  status: number;
}
