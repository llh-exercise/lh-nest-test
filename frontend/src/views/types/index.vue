<template>
  <div class="types-page">
    <div class="types-page__toolbar">
      <el-button type="primary" @click="handleAdd">新增分类</el-button>
      <el-button
        type="primary"
        :disabled="addSubDisabled"
        @click="handleAddSub"
      >
        新增下级分类
      </el-button>
    </div>

    <vxe-grid
      ref="gridRef"
      class="types-page__table"
      v-bind="gridOptions"
      v-on="gridEvents"
      :loading="loading"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type {
  VxeGridInstance,
  VxeGridListeners,
  VxeGridProps,
  VxeTableDefines,
} from 'vxe-table';
import type { TypesEditRow, TypesRecord } from '@/types/types';
import {
  applyRowLabel,
  deleteTypesRow,
  fetchTypesList,
  isTempTypesRow,
  recordToEditRow,
  saveTypesRow,
  swapTypesIndex,
  updateTypesStatus,
} from '@/api/types';

const gridRef = ref<VxeGridInstance<TypesEditRow> | null>(null);
const loading = ref(false);
const deleting = ref(false);
/** 全部行固定 id，仅前端展示用 */
const ALL_ROW_ID = '__all__';
const selectedRow = ref<TypesEditRow | null>(null);
const contextMenuRow = ref<TypesEditRow | null>(null);
const editingFieldRowId = ref<string | null>(null);
const expandedRowIdSet = ref<Set<string>>(new Set());
let tempIdSeed = 0;

interface GridEditCellResult {
  row?: TypesEditRow;
}

/** 新增下级按钮是否禁用：未选中行、全部行或选中未保存行时禁用 */
const addSubDisabled = computed(() => {
  const row = selectedRow.value;
  if (!row || isAllRow(row)) {
    return true;
  }
  return isTempTypesRow(row);
});

/** 表格配置 */
const gridOptions = reactive<VxeGridProps<TypesEditRow>>({
  border: true,
  showOverflow: true,
  rowConfig: {
    keyField: 'id',
    isCurrent: true,
  },
  treeConfig: {
    transform: true,
    rowField: 'id',
    parentField: 'parentId',
  },
  editConfig: {
    trigger: 'dblclick',
    mode: 'row',
    showStatus: true,
    beforeEditMethod({ row }) {
      return !isAllRow(row);
    },
  },
  columns: [
    {
      field: 'code',
      title: '编码',
      minWidth: 60,
      treeNode: true,
      editRender: {
        name: 'input',
        props: {
          placeholder: '请输入编码',
        },
      },
    },
    {
      field: 'name',
      title: '名称',
      minWidth: 120,
      formatter({ row }) {
        return row.label;
      },
      editRender: {
        name: 'input',
        props: {
          placeholder: '请输入名称',
        },
      },
    },
    {
      field: 'note',
      title: '备注',
      minWidth: 40,
      editRender: {
        name: 'input',
        props: {
          placeholder: '请输入备注',
        },
      },
    },
  ],
  menuConfig: {
    body: {
      options: [
        [
          { code: 'delete', name: '删除' },
          { code: 'up', name: '上移' },
          { code: 'down', name: '下移' },
          { code: 'invalid', name: '废除' },
          { code: 'enable', name: '启用' },
        ],
      ],
    },
    /** 全部行不显示右键菜单 */
    visibleMethod({ row }) {
      return row?.id !== ALL_ROW_ID;
    },
  },
  data: [],
});

/** 表格事件：右键菜单、行选中、编辑态 */
const gridEvents: VxeGridListeners<TypesEditRow> = {
  /** 右键打开菜单时缓存当前行 */
  cellMenu({ row }) {
    contextMenuRow.value = resolveRowFromData(row) ?? row ?? null;
  },
  /** 右键菜单点击，按 menuConfig 的 code 分发 */
  menuClick({ row, menu }) {
    const targetRow = resolveMenuRow(row);
    if (!targetRow) {
      return;
    }

    selectedRow.value = targetRow;
    contextMenuRow.value = targetRow;
    gridRef.value?.setCurrentRow(targetRow);

    switch (menu.code) {
      case 'delete':
        void handleDelete(targetRow);
        break;
      case 'up':
        void handleMoveUp(targetRow);
        break;
      case 'down':
        void handleMoveDown(targetRow);
        break;
      case 'invalid':
        void handleInvalid(targetRow);
        break;
      case 'enable':
        void handleEnable(targetRow);
        break;
      default:
        break;
    }
  },
  /** 当前行变化时同步选中行 */
  currentRowChange: handleCurrentRowChange,
  /** 进入单元格编辑时记录编辑行 */
  editActivated: handleEditActived,
  /** 关闭单元格编辑时触发保存 */
  editClosed: handleEditClosed,
  /** 记录树节点展开状态 */
  toggleTreeExpand({ row, expanded }) {
    if (!row?.id || isTempTypesRow(row) || isAllRow(row)) {
      return;
    }
    if (expanded) {
      expandedRowIdSet.value.add(row.id);
    } else {
      expandedRowIdSet.value.delete(row.id);
    }
  },
};

/** 获取当前操作行：优先编辑中单元格，其次选中行缓存 */
function getOperatingRow(): TypesEditRow | null {
  const grid = gridRef.value;
  if (!grid) {
    return selectedRow.value;
  }

  const editCell = grid.getEditCell?.() as GridEditCellResult | null;
  if (editCell?.row) {
    selectedRow.value = editCell.row;
    return editCell.row;
  }

  const current = grid.getCurrentRecord() as TypesEditRow | null;
  if (current) {
    selectedRow.value = current;
    return current;
  }

  if (selectedRow.value) {
    const matched = gridOptions.data?.find(
      (item) => item.id === selectedRow.value?.id,
    );
    if (matched) {
      selectedRow.value = matched;
      return matched;
    }
  }

  return selectedRow.value;
}

/** 从表格数据中按 id 查找最新行引用 */
function findRowInData(rowId: string): TypesEditRow | null {
  return gridOptions.data?.find((item) => item.id === rowId) ?? null;
}

/** 将事件行解析为 data 中的最新引用 */
function resolveRowFromData(row?: TypesEditRow | null): TypesEditRow | null {
  if (!row) {
    return null;
  }
  return findRowInData(row.id) ?? row;
}

/** 解析右键菜单目标行：事件行 > 缓存行 > 当前操作行 */
function resolveMenuRow(row?: TypesEditRow | null): TypesEditRow | null {
  return (
    resolveRowFromData(row) ??
    resolveRowFromData(contextMenuRow.value) ??
    getOperatingRow()
  );
}

/** 是否为全部行 */
function isAllRow(row?: TypesEditRow | null): boolean {
  return row?.id === ALL_ROW_ID;
}

/** 创建全部行（固定首行，仅前端展示） */
function createAllRow(): TypesEditRow {
  return applyRowLabel({
    id: ALL_ROW_ID,
    parentId: null,
    code: '',
    name: '全部行',
    label: '全部行',
    note: '',
    index: -1,
    status: 1,
    statusLabel: '启用',
  });
}

/** 组装表格数据，保证全部行始终在首行 */
function buildTableData(records: TypesRecord[]): TypesEditRow[] {
  return [createAllRow(), ...records.map((item) => recordToEditRow(item))];
}

/** 保证全部行始终在数据首行 */
function ensureAllRowFirst(data: TypesEditRow[]): TypesEditRow[] {
  const others = data.filter((item) => !isAllRow(item));
  return [createAllRow(), ...others];
}

/** 创建未落库的临时分类行 */
function createEmptyRow(parentId: string | null): TypesEditRow {
  tempIdSeed += 1;
  return applyRowLabel({
    id: `temp_${tempIdSeed}_${Date.now()}`,
    parentId,
    code: '',
    name: '',
    label: '',
    note: '',
    index: 0,
    status: 1,
    statusLabel: '启用',
  });
}

/** 从后端加载分类列表并刷新表格 */
async function loadTableData(): Promise<void> {
  loading.value = true;
  try {
    const list = await fetchTypesList();
    gridOptions.data = buildTableData(list);
  } finally {
    loading.value = false;
  }
}

/** 操作失败后重新拉取列表并恢复选中状态 */
async function reloadTableAfterFailure(): Promise<void> {
  await loadTableData();
  selectedRow.value = null;
  await nextTick();
  selectedRow.value = getOperatingRow();
}

/** 校验分类行必填字段 */
function validateRow(row: TypesEditRow): boolean {
  if (!row.code.trim()) {
    ElMessage.warning('编码不能为空');
    return false;
  }
  if (!row.name.trim()) {
    ElMessage.warning('名称不能为空');
    return false;
  }
  return true;
}

/** 收集当前已展开的树节点 id */
function captureExpandedRowIds(): string[] {
  const grid = gridRef.value;
  const idsFromGrid =
    grid?.getTreeExpandRecords().map((item) => item.id) ?? [];
  const idsFromSet = [...expandedRowIdSet.value];
  return [...new Set([...idsFromGrid, ...idsFromSet])].filter(
    (id) => !id.startsWith('temp_') && id !== ALL_ROW_ID,
  );
}

/** 恢复树节点展开状态 */
async function restoreTreeExpand(expandedIds: string[]): Promise<void> {
  const grid = gridRef.value;
  if (!grid || expandedIds.length === 0) {
    return;
  }

  await nextTick();
  const rows = expandedIds
    .map((id) => findRowInData(id))
    .filter((item): item is TypesEditRow => item !== null);

  if (rows.length > 0) {
    await grid.setTreeExpand(rows, true);
    rows.forEach((row) => {
      expandedRowIdSet.value.add(row.id);
    });
  }
}

/** 新增保存后替换临时行，同步 vxe-table 行 key 且保持树展开状态 */
async function syncRowAfterSave(
  oldRow: TypesEditRow,
  record: TypesRecord,
): Promise<TypesEditRow> {
  const newRow = recordToEditRow(record);
  const grid = gridRef.value;
  const expandedIds = captureExpandedRowIds();

  const data = [...(gridOptions.data ?? [])];
  const rowIndex = data.findIndex((item) => item.id === oldRow.id);
  if (rowIndex >= 0) {
    data.splice(rowIndex, 1, newRow);
  } else {
    data.push(newRow);
  }
  const nextData = ensureAllRowFirst(data);
  gridOptions.data = nextData;
  expandedRowIdSet.value.delete(oldRow.id);

  if (grid) {
    await grid.loadData(nextData);
    await restoreTreeExpand(expandedIds);
    if (newRow.parentId) {
      expandedRowIdSet.value.add(newRow.parentId);
      const parent = findRowInData(newRow.parentId);
      if (parent) {
        await grid.setTreeExpand(parent, true);
      }
    }
  }

  const savedRow = findRowInData(newRow.id) ?? newRow;
  selectedRow.value = savedRow;
  contextMenuRow.value = savedRow;
  if (grid) {
    await nextTick();
    grid.setCurrentRow(savedRow);
  }
  return savedRow;
}

/** 保存单行分类到后端（新增或更新） */
async function saveTypesRowLocal(row: TypesEditRow): Promise<void> {
  if (isAllRow(row)) {
    return;
  }
  if (!validateRow(row)) {
    return;
  }

  const wasTemp = isTempTypesRow(row);

  try {
    const record = await saveTypesRow(row);
    if (wasTemp) {
      await syncRowAfterSave(row, record);
      return;
    }
    Object.assign(row, recordToEditRow(record));
    selectedRow.value = resolveRowFromData(row);
  } catch {
    await reloadTableAfterFailure();
  }
}

/** 当前行变化事件处理 */
function handleCurrentRowChange(
  params: VxeTableDefines.CurrentRowChangeEventParams<TypesEditRow>,
): void {
  selectedRow.value = resolveRowFromData(params.row) ?? params.row ?? null;
}

/** 从表格数据中移除指定行 */
function removeRowFromTable(rowId: string): void {
  if (rowId === ALL_ROW_ID) {
    return;
  }
  gridOptions.data = ensureAllRowFirst(
    gridOptions.data?.filter((item) => item.id !== rowId) ?? [],
  );
  selectedRow.value = null;
  editingFieldRowId.value = null;
}

/** 选中行并聚焦到指定字段进入编辑 */
async function focusEditRow(
  row: TypesEditRow,
  field: keyof TypesEditRow,
): Promise<void> {
  selectedRow.value = row;
  await nextTick();
  gridRef.value?.setCurrentRow(row);
  await gridRef.value?.setEditCell(row, field);
  editingFieldRowId.value = row.id;
}

/** 新增顶级分类 */
async function handleAdd(): Promise<void> {
  const row = createEmptyRow(null);
  gridOptions.data = ensureAllRowFirst([...(gridOptions.data ?? []), row]);
  await focusEditRow(row, 'code');
}

/** 新增下级分类 */
async function handleAddSub(): Promise<void> {
  const currentRow = getOperatingRow();
  if (!currentRow) {
    ElMessage.warning('请先选中上级分类');
    return;
  }
  if (isTempTypesRow(currentRow)) {
    ElMessage.warning('请先保存上级分类后再新增下级');
    return;
  }

  const row = createEmptyRow(currentRow.id);
  gridOptions.data = ensureAllRowFirst([...(gridOptions.data ?? []), row]);
  await focusEditRow(row, 'code');
}

/** 删除分类（工具栏按钮或右键菜单） 
 *  如果当前行及其子集存在明细，则不能删除，可以在调用删除的时候进行判断
*/
async function handleDelete(row?: TypesEditRow): Promise<void> {
  const currentRow = row ?? getOperatingRow();
  if (!currentRow || isAllRow(currentRow)) {
    ElMessage.warning('请先选中要删除的分类');
    return;
  }

  if (row) {
    selectedRow.value = row;
    gridRef.value?.setCurrentRow(row);
  }

  if (isTempTypesRow(currentRow)) {
    removeRowFromTable(currentRow.id);
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定删除分类「${currentRow.name}」吗？`,
      '提示',
      { type: 'warning' },
    );
  } catch {
    return;
  }

  deleting.value = true;
  try {
    await deleteTypesRow(currentRow.id);
    removeRowFromTable(currentRow.id);
    ElMessage.success('删除成功');
  } catch {
    await reloadTableAfterFailure();
  } finally {
    deleting.value = false;
  }
}

/** 操作完成后重新选中指定行 */
async function focusCurrentRow(row: TypesEditRow): Promise<void> {
  const matched = gridOptions.data?.find((item) => item.id === row.id) ?? null;
  if (!matched) {
    return;
  }
  selectedRow.value = matched;
  await nextTick();
  gridRef.value?.setCurrentRow(matched);
}

/** 表格内上移一行 */
function modePrevRow(row: TypesEditRow): void {
  const $grid = gridRef.value;
  if ($grid) {
    $grid.moveRowTo(row, -1);
  }
}

/** 表格内下移一行 */
function modeNextRow(row: TypesEditRow): void {
  const $grid = gridRef.value;
  if ($grid) {
    $grid.moveRowTo(row, 1);
  }
}

/** 获取同级已保存分类（按 index 升序） */
function getSiblingRows(row: TypesEditRow): TypesEditRow[] {
  return (gridOptions.data ?? [])
    .filter(
      (item) =>
        item.parentId === row.parentId &&
        !isTempTypesRow(item) &&
        !isAllRow(item),
    )
    .sort((a, b) => a.index - b.index || a.id.localeCompare(b.id));
}

/** 上移分类：与上一个同级交换 index */
async function handleMoveUp(row: TypesEditRow): Promise<void> {
  if (isAllRow(row)) {
    return;
  }
  if (isTempTypesRow(row)) {
    ElMessage.warning('请先保存分类后再移动');
    return;
  }

  const siblings = getSiblingRows(row);
  const currentIndex = siblings.findIndex((item) => item.id === row.id);
  if (currentIndex <= 0) {
    ElMessage.info('已是同级第一个，无法上移');
    return;
  }

  const prevRow = siblings[currentIndex - 1];
  try {
    await swapTypesIndex(row, prevRow);
    modePrevRow(row);
    await focusCurrentRow(row);
    ElMessage.success('上移成功');
  } catch {
    await reloadTableAfterFailure();
  }
}

/** 下移分类：与下一个同级交换 index */
async function handleMoveDown(row: TypesEditRow): Promise<void> {
  if (isAllRow(row)) {
    return;
  }
  if (isTempTypesRow(row)) {
    ElMessage.warning('请先保存分类后再移动');
    return;
  }

  const siblings = getSiblingRows(row);
  const currentIndex = siblings.findIndex((item) => item.id === row.id);
  if (currentIndex < 0 || currentIndex >= siblings.length - 1) {
    ElMessage.info('已是同级最后一个，无法下移');
    return;
  }

  const nextRow = siblings[currentIndex + 1];
  try {
    await swapTypesIndex(row, nextRow);
    modeNextRow(row);
    await focusCurrentRow(row);
    ElMessage.success('下移成功');
  } catch {
    await reloadTableAfterFailure();
  }
}

/** 废除分类：PUT 更新 status 为 0 */
async function handleInvalid(row: TypesEditRow): Promise<void> {
  if (isAllRow(row)) {
    return;
  }
  if (isTempTypesRow(row)) {
    ElMessage.warning('请先保存分类后再废弃');
    return;
  }
  if (row.status === 0) {
    ElMessage.info('当前分类已是废弃状态');
    return;
  }

  try {
    const record = await updateTypesStatus(row.id, 0);
    Object.assign(row, recordToEditRow(record));
    ElMessage.success('已废弃');
  } catch {
    await reloadTableAfterFailure();
  }
}

/** 启用分类：PUT 更新 status 为 1 */
async function handleEnable(row: TypesEditRow): Promise<void> {
  if (isAllRow(row)) {
    return;
  }
  if (isTempTypesRow(row)) {
    ElMessage.warning('请先保存分类后再启用');
    return;
  }
  if (row.status === 1) {
    ElMessage.info('当前分类已是启用状态');
    return;
  }

  try {
    const record = await updateTypesStatus(row.id, 1);
    Object.assign(row, recordToEditRow(record));
    ElMessage.success('已启用');
  } catch {
    await reloadTableAfterFailure();
  }
}

/** 进入单元格编辑事件处理 */
function handleEditActived(
  params: VxeTableDefines.EditActivatedEventParams<TypesEditRow>,
): void {
  if (
    params.column.field === 'code' ||
    params.column.field === 'name' ||
    params.column.field === 'note'
  ) {
    editingFieldRowId.value = params.row.id;
  }
}

/** 关闭单元格编辑事件处理，触发保存 */
function handleEditClosed(
  params: VxeTableDefines.EditClosedEventParams<TypesEditRow>,
): void {
  if (isAllRow(params.row)) {
    return;
  }
  if (
    params.column.field !== 'code' &&
    params.column.field !== 'name' &&
    params.column.field !== 'note'
  ) {
    return;
  }
  editingFieldRowId.value = null;
  if (params.column.field === 'name') {
    applyRowLabel(params.row);
  }
  void saveTypesRowLocal(params.row);
}

onMounted(() => {
  void loadTableData();
});
</script>

<style lang="scss" scoped>
.types-page {
  &__toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__table {
    width: 100%;
  }
}
</style>
