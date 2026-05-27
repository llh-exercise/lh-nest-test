<template>
  <div class="details-page">
    <div class="details-page__toolbar">
      <el-button type="primary" :disabled="addDisabled" @click="handleAdd">
        新增明细
      </el-button>
      <el-input
        v-model="searchKeyword"
        class="details-page__search"
        placeholder="搜索编码/项目名称"
        clearable
      />
    </div>

    <vxe-grid
      ref="gridRef"
      class="details-page__table"
      v-bind="gridOptions"
      v-on="gridEvents"
      :loading="loading"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { storeToRefs } from 'pinia';
import type {
  VxeGridInstance,
  VxeGridListeners,
  VxeGridProps,
  VxeTableDefines,
} from 'vxe-table';
import type { DetailsEditRow, DetailsRecord } from '@/types/details';
import {
  applyRowLabel,
  deleteDetailsRow,
  fetchDetailsList,
  isTempDetailsRow,
  recordToEditRow,
  saveDetailsRow,
  swapDetailsIndex,
  updateDetailsStatus,
} from '@/api/details';
import { useTypesStore } from '@/stores/types';

const typesStore = useTypesStore();
const { selectedTypeId, selectedTypeIsLeaf, selectedTypeIsSaved, selectedTypeIsEnabled, selectedTypeIsAll, detailsRefreshSeed } =
  storeToRefs(typesStore);

const gridRef = ref<VxeGridInstance<DetailsEditRow> | null>(null);
const loading = ref(false);
const deleting = ref(false);
const searchKeyword = ref('');
/** 明细全量数据（搜索仅过滤展示，不改动此数据） */
const tableData = ref<DetailsEditRow[]>([]);
const selectedRow = ref<DetailsEditRow | null>(null);
const contextMenuRow = ref<DetailsEditRow | null>(null);
const editingFieldRowId = ref<string | null>(null);
let tempIdSeed = 0;

/** 可编辑列字段 */
const EDIT_FIELDS: Array<keyof DetailsEditRow> = [
  'code',
  'projectName',
  'workContent',
  'contractor',
  'calcRule',
  'unit',
];

interface GridEditCellResult {
  row?: DetailsEditRow;
}

/** 新增按钮是否禁用：全部行、未选中已保存且启用的末级分类时禁用 */
const addDisabled = computed(
  () =>
    selectedTypeIsAll.value ||
    !selectedTypeId.value ||
    !selectedTypeIsLeaf.value ||
    !selectedTypeIsSaved.value ||
    !selectedTypeIsEnabled.value,
);




/** 表格配置 */
const gridOptions = reactive<VxeGridProps<DetailsEditRow>>({
  border: true,
  showOverflow: true,
  rowConfig: {
    keyField: 'id',
    isCurrent: true,
  },
  /** 废弃行文字变灰 */
  rowClassName({ row }) {
    if (row.status !== 0) {
      return '';
    }
    return 'details-page__row--invalid';
  },
  editConfig: {
    trigger: 'dblclick',
    mode: 'row',
    showIcon: false,
    showStatus: true,
  },
  columns: [
    {
      field: 'code',
      title: '编码',
      minWidth: 80,
      editRender: {
        name: 'input',
        props: { placeholder: '请输入编码' },
      },
    },
    {
      field: 'projectName',
      title: '项目名称',
      minWidth: 120,
      formatter({ row }) {
        return row.label;
      },
      editRender: {
        name: 'input',
        props: { placeholder: '请输入项目名称' },
      },
    },
    {
      field: 'workContent',
      title: '工作内容',
      minWidth: 120,
      editRender: {
        name: 'input',
        props: { placeholder: '请输入工作内容' },
      },
    },
    {
      field: 'contractor',
      title: '乙方承包商',
      minWidth: 100,
      editRender: {
        name: 'input',
        props: { placeholder: '请输入乙方承包商' },
      },
    },
    {
      field: 'calcRule',
      title: '计算规则',
      minWidth: 100,
      editRender: {
        name: 'input',
        props: { placeholder: '请输入计算规则' },
      },
    },
    {
      field: 'unit',
      title: '计量单位',
      minWidth: 80,
      editRender: {
        name: 'input',
        props: { placeholder: '请输入计量单位' },
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
          { code: 'invalid', name: '废弃' },
          { code: 'enable', name: '启用' },
        ],
      ],
    },
    /** 根据当前行动态控制右键菜单项显示（须放在 menuConfig 顶层） */
    visibleMethod({ row, rowIndex, options }) {
      if (!options || !row) {
        return false;
      }

      const menuRow = resolveMenuContextRow(row, rowIndex);
      if (!menuRow) {
        return false;
      }

      const isAllMode = selectedTypeIsAll.value;
      const displayRows = getMenuDisplayRows();
      const siblingIndex = displayRows.findIndex((item) => item.id === menuRow.id);
      const canMove =
        !isAllMode &&
        !isTempDetailsRow(menuRow) &&
        siblingIndex >= 0;
      const canMoveUp = canMove && siblingIndex > 0;
      const canMoveDown = canMove && siblingIndex < displayRows.length - 1;

      for (const group of options) {
        for (const item of group) {
          if (item.code === 'up') {
            item.visible = canMoveUp;
          } else if (item.code === 'down') {
            item.visible = canMoveDown;
          } else if (item.code === 'invalid') {
            item.visible =
              !isAllMode &&
              !isTempDetailsRow(menuRow) &&
              menuRow.status === 1;
          } else if (item.code === 'enable') {
            item.visible =
              !isAllMode &&
              !isTempDetailsRow(menuRow) &&
              menuRow.status === 0;
          } else {
            item.visible = true;
          }
        }
      }

      return true;
    },
  },
  data: [],
});




/** 按关键字过滤表格展示数据（编码、项目名称模糊匹配） */
function applyTableFilter(): void {
  const keyword = searchKeyword.value.trim().toLowerCase();
  if (!keyword) {
    gridOptions.data = [...tableData.value];
    return;
  }

  gridOptions.data = tableData.value.filter(
    (row) =>
      isTempDetailsRow(row) ||
      row.code.toLowerCase().includes(keyword) ||
      row.projectName.toLowerCase().includes(keyword),
  );
}




/** 从全量数据中按 id 查找行 */
function findRowInData(rowId: string): DetailsEditRow | null {
  return tableData.value.find((item) => item.id === rowId) ?? null;
}

/** 将事件行解析为全量数据中的最新引用 */
function resolveRowFromData(row?: DetailsEditRow | null): DetailsEditRow | null {
  if (!row) {
    return null;
  }
  return findRowInData(row.id) ?? row;
}

/** 获取当前操作行：优先编辑中单元格，其次选中行缓存 */
function getOperatingRow(): DetailsEditRow | null {
  const grid = gridRef.value;
  if (!grid) {
    return selectedRow.value;
  }

  const editCell = grid.getEditCell?.() as GridEditCellResult | null;
  if (editCell?.row) {
    selectedRow.value = editCell.row;
    return editCell.row;
  }

  const current = grid.getCurrentRecord() as DetailsEditRow | null;
  if (current) {
    selectedRow.value = current;
    return current;
  }

  if (selectedRow.value) {
    const matched = findRowInData(selectedRow.value.id);
    if (matched) {
      selectedRow.value = matched;
      return matched;
    }
  }

  return selectedRow.value;
}

/** 获取表格当前展示行（用于右键菜单，反映 moveRowTo 后的视觉顺序） */
function getMenuDisplayRows(): DetailsEditRow[] {
  const grid = gridRef.value;
  const fullData = (
    grid?.getTableData?.().fullData ?? gridOptions.data ?? []
  ) as DetailsEditRow[];

  return fullData.filter((item) => !isTempDetailsRow(item));
}

/** 按视觉行号解析右键目标行（moveRowTo 后 row 引用可能错位，以 rowIndex 为准） */
function resolveMenuContextRow(
  row?: DetailsEditRow | null,
  rowIndex?: number,
): DetailsEditRow | null {
  const displayRows = getMenuDisplayRows();
  if (
    rowIndex !== undefined &&
    rowIndex >= 0 &&
    rowIndex < displayRows.length
  ) {
    const displayRow = displayRows[rowIndex];
    return findRowInData(displayRow.id) ?? displayRow;
  }

  return resolveRowFromData(row) ?? row ?? null;
}

/** 解析右键菜单目标行：缓存行 > 事件行 > 当前操作行 */
function resolveMenuRow(row?: DetailsEditRow | null): DetailsEditRow | null {
  return (
    resolveRowFromData(contextMenuRow.value) ??
    resolveMenuContextRow(row) ??
    getOperatingRow()
  );
}

/** 解析上移/下移操作行（优先使用 cellMenu 缓存） */
function resolveMoveRow(row?: DetailsEditRow | null): DetailsEditRow | null {
  return (
    resolveRowFromData(contextMenuRow.value) ??
    resolveRowFromData(row) ??
    row ??
    null
  );
}

/** 选中行并聚焦到指定字段进入编辑 */
async function focusEditRow(
  row: DetailsEditRow,
  field: keyof DetailsEditRow,
): Promise<void> {
  selectedRow.value = row;
  await nextTick();
  gridRef.value?.setCurrentRow(row);
  await gridRef.value?.setEditCell(row, field);
  editingFieldRowId.value = row.id;
}

/** 操作完成后重新选中指定行 */
async function focusCurrentRow(row: DetailsEditRow): Promise<void> {
  const matched = findRowInData(row.id);
  if (!matched) {
    return;
  }
  selectedRow.value = matched;
  await nextTick();
  gridRef.value?.setCurrentRow(matched);
}




/** 创建未落库的临时明细行 */
function createEmptyRow(typeId: string): DetailsEditRow {
  tempIdSeed += 1;
  return applyRowLabel({
    id: `temp_${tempIdSeed}_${Date.now()}`,
    typeId,
    code: '',
    projectName: '',
    label: '',
    workContent: '',
    contractor: '',
    calcRule: '',
    unit: '',
    index: 0,
    status: 1,
    statusLabel: '启用',
  });
}




/** 新增明细（按钮 disabled 已保证选中条件） */
async function handleAdd(): Promise<void> {
  const row = createEmptyRow(selectedTypeId.value);
  tableData.value = [...tableData.value, row];
  applyTableFilter();
  await focusEditRow(row, 'code');
}

/** 从后端加载明细列表并刷新表格 */
async function loadTableData(): Promise<void> {
  loading.value = true;
  try {
    if (!selectedTypeIsAll.value && !selectedTypeId.value) {
      tableData.value = [];
      applyTableFilter();
      return;
    }
    const list = await fetchDetailsList(
      selectedTypeIsAll.value ? undefined : selectedTypeId.value,
    );
    tableData.value = list.map((item) => recordToEditRow(item));
    applyTableFilter();
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

/** 校验明细行必填字段，一次性提示所有未填项 */
function validateRow(row: DetailsEditRow): boolean {
  const errors: string[] = [];

  if (!row.code.trim()) {
    errors.push('编码不能为空');
  }
  if (!row.projectName.trim()) {
    errors.push('项目名称不能为空');
  }
  if (!row.unit.trim()) {
    errors.push('计量单位不能为空');
  }

  if (errors.length > 0) {
    ElMessage.warning(errors.join('；'));
    return false;
  }

  return true;
}




/** 新增保存后替换临时行，同步 vxe-table 行 key */
async function syncRowAfterSave(
  oldRow: DetailsEditRow,
  record: DetailsRecord,
): Promise<DetailsEditRow> {
  const newRow = recordToEditRow(record);
  const grid = gridRef.value;
  const data = [...tableData.value];
  const rowIndex = data.findIndex((item) => item.id === oldRow.id);
  if (rowIndex >= 0) {
    data.splice(rowIndex, 1, newRow);
  } else {
    data.push(newRow);
  }
  tableData.value = data;
  applyTableFilter();

  if (grid) {
    await grid.loadData(gridOptions.data ?? []);
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

/** 保存单行明细到后端（新增或更新） */
async function saveDetailsRowLocal(row: DetailsEditRow): Promise<void> {
  if (isTempDetailsRow(row) && !row.typeId) {
    ElMessage.warning('请先在左侧选择分类');
    return;
  }
  if (!validateRow(row)) {
    return;
  }

  const wasTemp = isTempDetailsRow(row);

  try {
    const record = await saveDetailsRow(row);
    if (wasTemp) {
      await syncRowAfterSave(row, record);
      ElMessage.success('新增成功');
      return;
    }
    Object.assign(row, recordToEditRow(record));
    applyTableFilter();
    selectedRow.value = resolveRowFromData(row);
    ElMessage.success('保存成功');
  } catch {
    await reloadTableAfterFailure();
  }
}

/** 当前行变化事件处理 */
function handleCurrentRowChange(
  params: VxeTableDefines.CurrentRowChangeEventParams<DetailsEditRow>,
): void {
  selectedRow.value = resolveRowFromData(params.row) ?? params.row ?? null;
}

/** 进入单元格编辑事件处理 */
function handleEditActived(
  params: VxeTableDefines.EditActivatedEventParams<DetailsEditRow>,
): void {
  if (EDIT_FIELDS.includes(params.column.field as keyof DetailsEditRow)) {
    editingFieldRowId.value = params.row.id;
  }
}

/** 关闭单元格编辑事件处理，触发保存 */
function handleEditClosed(
  params: VxeTableDefines.EditClosedEventParams<DetailsEditRow>,
): void {
  if (!EDIT_FIELDS.includes(params.column.field as keyof DetailsEditRow)) {
    return;
  }
  editingFieldRowId.value = null;
  if (params.column.field === 'projectName') {
    applyRowLabel(params.row);
  }
  void saveDetailsRowLocal(params.row);
}




/** 从全量数据中移除指定行 */
function removeRowFromTable(rowId: string): void {
  tableData.value = tableData.value.filter((item) => item.id !== rowId);
  applyTableFilter();
  selectedRow.value = null;
  editingFieldRowId.value = null;
}

/** 删除明细（右键菜单），未保存行仅前端移除 */
async function handleDelete(row?: DetailsEditRow): Promise<void> {
  const currentRow = row ?? getOperatingRow();
  if (!currentRow) {
    ElMessage.warning('请先选中要删除的明细');
    return;
  }

  if (row) {
    selectedRow.value = row;
    gridRef.value?.setCurrentRow(row);
  }

  if (isTempDetailsRow(currentRow)) {
    removeRowFromTable(currentRow.id);
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定删除明细「${currentRow.projectName}」吗？`,
      '提示',
      { type: 'warning' },
    );
  } catch {
    return;
  }

  deleting.value = true;
  try {
    await deleteDetailsRow(currentRow.id);
    removeRowFromTable(currentRow.id);
    ElMessage.success('删除成功');
  } catch {
    await reloadTableAfterFailure();
  } finally {
    deleting.value = false;
  }
}




/** 将后端记录同步到 tableData（按 id 匹配，保证 index 与菜单计算一致） */
function applyRecordsToTableData(...records: DetailsRecord[]): void {
  for (const record of records) {
    const matched = findRowInData(record.id);
    if (matched) {
      Object.assign(matched, recordToEditRow(record));
    }
  }
}

/** 按 index 重排全量数据，保持 tableData 顺序与排序字段一致 */
function refreshTableDataOrder(): void {
  tableData.value = [...tableData.value].sort((a, b) => {
    if (isTempDetailsRow(a) !== isTempDetailsRow(b)) {
      return isTempDetailsRow(a) ? 1 : -1;
    }
    return a.index - b.index || a.id.localeCompare(b.id);
  });
}

/** 表格内上移一行（即时更新视图） */
function modePrevRow(row: DetailsEditRow): void {
  gridRef.value?.moveRowTo(row, -1);
}

/** 表格内下移一行（即时更新视图） */
function modeNextRow(row: DetailsEditRow): void {
  gridRef.value?.moveRowTo(row, 1);
}

/** 获取同级已保存明细（按 index 升序，用于上移/下移交换） */
function getSiblingRows(_row: DetailsEditRow): DetailsEditRow[] {
  return tableData.value
    .filter((item) => !isTempDetailsRow(item))
    .sort((a, b) => a.index - b.index || a.id.localeCompare(b.id));
}

/** 获取表格当前展示行（用于 moveRowTo，须使用表格内部行引用） */
function findGridRowById(rowId: string): DetailsEditRow | null {
  const displayRow = getMenuDisplayRows().find((item) => item.id === rowId);
  if (displayRow) {
    return displayRow;
  }
  return findRowInData(rowId);
}

/** 移动完成后同步选中状态 */
async function finalizeMoveSelection(movedRowId: string): Promise<void> {
  const matched = findRowInData(movedRowId);
  if (!matched) {
    return;
  }

  selectedRow.value = matched;
  contextMenuRow.value = matched;
  await focusCurrentRow(matched);
}

/** 上移明细：与上一个同级交换 index */
async function handleMoveUp(row: DetailsEditRow): Promise<void> {
  if (selectedTypeIsAll.value) {
    return;
  }
  const menuRow = resolveMoveRow(row);
  if (!menuRow || isTempDetailsRow(menuRow)) {
    if (menuRow) {
      ElMessage.warning('请先保存明细后再移动');
    }
    return;
  }

  const siblings = getSiblingRows(menuRow);
  const currentIndex = siblings.findIndex((item) => item.id === menuRow.id);
  if (currentIndex <= 0) {
    return;
  }

  const prevRow = siblings[currentIndex - 1];
  const sourceRow = findRowInData(menuRow.id) ?? menuRow;
  const targetRow = findRowInData(prevRow.id) ?? prevRow;

  try {
    const { sourceRecord, targetRecord } = await swapDetailsIndex(
      sourceRow,
      targetRow,
    );
    applyRecordsToTableData(sourceRecord, targetRecord);
    refreshTableDataOrder();

    const gridRow = findGridRowById(menuRow.id);
    if (gridRow) {
      modePrevRow(gridRow);
    }

    await finalizeMoveSelection(menuRow.id);
    ElMessage.success('上移成功');
  } catch {
    await reloadTableAfterFailure();
  }
}

/** 下移明细：与下一个同级交换 index */
async function handleMoveDown(row: DetailsEditRow): Promise<void> {
  if (selectedTypeIsAll.value) {
    return;
  }
  const menuRow = resolveMoveRow(row);
  if (!menuRow || isTempDetailsRow(menuRow)) {
    if (menuRow) {
      ElMessage.warning('请先保存明细后再移动');
    }
    return;
  }

  const siblings = getSiblingRows(menuRow);
  const currentIndex = siblings.findIndex((item) => item.id === menuRow.id);
  if (currentIndex < 0 || currentIndex >= siblings.length - 1) {
    return;
  }

  const nextRow = siblings[currentIndex + 1];
  const sourceRow = findRowInData(menuRow.id) ?? menuRow;
  const targetRow = findRowInData(nextRow.id) ?? nextRow;

  try {
    const { sourceRecord, targetRecord } = await swapDetailsIndex(
      sourceRow,
      targetRow,
    );
    applyRecordsToTableData(sourceRecord, targetRecord);
    refreshTableDataOrder();

    const gridRow = findGridRowById(menuRow.id);
    if (gridRow) {
      modeNextRow(gridRow);
    }

    await finalizeMoveSelection(menuRow.id);
    ElMessage.success('下移成功');
  } catch {
    await reloadTableAfterFailure();
  }
}




/** 废弃明细 */
async function handleInvalid(row: DetailsEditRow): Promise<void> {
  if (selectedTypeIsAll.value) {
    return;
  }
  if (isTempDetailsRow(row)) {
    ElMessage.warning('请先保存明细后再废弃');
    return;
  }
  if (row.status === 0) {
    ElMessage.info('当前明细已是废弃状态');
    return;
  }

  try {
    await updateDetailsStatus(row.id, 0);
    await loadTableData();
    const matched = findRowInData(row.id);
    if (matched) {
      selectedRow.value = matched;
      await nextTick();
      gridRef.value?.setCurrentRow(matched);
    }
    ElMessage.success('已废弃');
  } catch {
    await reloadTableAfterFailure();
  }
}

/** 启用明细 */
async function handleEnable(row: DetailsEditRow): Promise<void> {
  if (selectedTypeIsAll.value) {
    return;
  }
  if (isTempDetailsRow(row)) {
    ElMessage.warning('请先保存明细后再启用');
    return;
  }
  if (row.status === 1) {
    ElMessage.info('当前明细已是启用状态');
    return;
  }

  try {
    await updateDetailsStatus(row.id, 1);
    await loadTableData();
    const matched = findRowInData(row.id);
    if (matched) {
      selectedRow.value = matched;
      await nextTick();
      gridRef.value?.setCurrentRow(matched);
    }
    ElMessage.success('已启用');
  } catch {
    await reloadTableAfterFailure();
  }
}




/** 表格事件：右键菜单、行选中、编辑态 */
const gridEvents: VxeGridListeners<DetailsEditRow> = {
  /** 右键打开菜单时缓存当前行（按视觉行号解析，避免 moveRowTo 后 row 引用错位） */
  cellMenu({ row, rowIndex }) {
    if (!row) {
      contextMenuRow.value = null;
      return;
    }
    contextMenuRow.value = resolveMenuContextRow(row, rowIndex);
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
  currentRowChange: handleCurrentRowChange,
  editActivated: handleEditActived,
  editClosed: handleEditClosed,
};




/** 搜索关键字变化时重新过滤展示 */
watch(searchKeyword, () => {
  applyTableFilter();
});

/** 选中分类变化时重新加载明细列表 */
watch(
  [selectedTypeId, selectedTypeIsAll],
  () => {
    searchKeyword.value = '';
    selectedRow.value = null;
    contextMenuRow.value = null;
    void loadTableData();
  },
  { immediate: true },
);

/** 分类废弃/启用级联变更后刷新当前明细列表 */
watch(detailsRefreshSeed, () => {
  if (!selectedTypeId.value && !selectedTypeIsAll.value) {
    return;
  }
  void loadTableData();
});
</script>

<style lang="scss" scoped>
.details-page {
  &__toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__search {
    width: 220px;
  }

  &__table {
    width: 100%;

    :deep(.details-page__row--invalid) {
      color: var(--el-text-color-secondary);
    }
  }
}
</style>
