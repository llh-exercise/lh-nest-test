<template>
  <el-dialog
    :model-value="true"
    title="维护版本"
    width="720px"
    @close="handleClose"
  >
    <div class="version-edit-dialog">
      <div class="version-edit-dialog__toolbar">
        <div class="version-edit-dialog__toolbar-left">
          <el-button type="primary" @click="handleAdd">新增</el-button>
          <el-button
            :disabled="statusActionDisabled"
            :loading="statusToggling"
            @click="handleToggleStatus"
          >
            {{ statusActionLabel }}
          </el-button>
        </div>
        <el-button
          type="danger"
          :disabled="deleteDisabled"
          :loading="deleting"
          @click="handleDelete"
        >
          删除
        </el-button>
      </div>

      <vxe-grid
        ref="gridRef"
        class="version-edit-dialog__grid"
        v-bind="gridOptions"
        @current-row-change="handleCurrentRowChange"
        @edit-activated="handleEditActived"
        @edit-closed="handleEditClosed"
      />
    </div>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { VxeGridInstance, VxeGridProps, VxeTableDefines } from 'vxe-table';
import type { VersionEditRow, VersionRecord } from '@/types/version';
import {
  deleteVersionRow,
  disableVersionRow,
  enableVersionRow,
  fetchVersionList,
  isTempVersionRow,
  recordToEditRow,
  saveVersionRow,
} from '@/api/version';

const emit = defineEmits<{
  /** 关闭弹窗，changed 为 true 时父组件需刷新列表 */
  close: [changed: boolean];
}>();

const gridRef = ref<VxeGridInstance<VersionEditRow> | null>(null);
const statusToggling = ref(false);
const deleting = ref(false);
/** 弹窗内是否发生过新增/修改/删除（已落库） */
const dataChanged = ref(false);
/** 当前操作行（新增/选中），避免编辑态下 getCurrentRecord 为空 */
const selectedRow = ref<VersionEditRow | null>(null);
/** 正在编辑名称列的行 id */
const editingNameRowId = ref<string | null>(null);
let tempIdSeed = 0;

/** 未选中行时不可切换启用状态 */
const statusActionDisabled = computed(() => !selectedRow.value);

/** 按选中行状态展示「启用」或「停用」 */
const statusActionLabel = computed(() => {
  const row = selectedRow.value;
  if (!row || row.enabledStatus !== '已启用') {
    return '启用';
  }
  return '停用';
});

/** 未选中，或当前行名称正在编辑时不可点删除 */
const deleteDisabled = computed(() => {
  const row = selectedRow.value;
  if (!row) {
    return true;
  }
  return editingNameRowId.value === row.id;
});

interface GridEditCellResult {
  row?: VersionEditRow;
}

/** 获取当前操作行：优先编辑中单元格，其次选中行缓存 */
function getOperatingRow(): VersionEditRow | null {
  const grid = gridRef.value;
  if (!grid) {
    return selectedRow.value;
  }

  const editCell = grid.getEditCell?.() as GridEditCellResult | null;
  if (editCell?.row) {
    selectedRow.value = editCell.row;
    return editCell.row;
  }

  const current = grid.getCurrentRecord() as VersionEditRow | null;
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

const gridOptions = reactive<VxeGridProps<VersionEditRow>>({
  border: true,
  showOverflow: true,
  maxHeight: 360,
  rowConfig: {
    keyField: 'id',
    isCurrent: true,
  },
  editConfig: {
    trigger: 'dblclick',
    mode: 'cell',
    showStatus: true,
  },
  columns: [
    {
      field: 'name',
      title: '名称',
      minWidth: 200,
      editRender: {
        name: 'input',
        props: {
          placeholder: '请输入名称',
        },
      },
    },
    {
      field: 'enabledStatus',
      title: '启用状态',
      width: 120,
    },
  ],
  data: [],
});

function createEmptyRow(): VersionEditRow {
  tempIdSeed += 1;
  return {
    id: `temp_${tempIdSeed}_${Date.now()}`,
    name: '',
    enabledStatus: '未启用',
  };
}

async function loadTableData(): Promise<VersionRecord[]> {
  const list = await fetchVersionList();
  gridOptions.data = list.map((item) => recordToEditRow(item));
  return list;
}

function markDataChanged(): void {
  dataChanged.value = true;
}

/** 新增/更新失败后从服务端重新拉取列表 */
async function reloadTableAfterFailure(): Promise<void> {
  await loadTableData();
  selectedRow.value = null;
  await nextTick();
  selectedRow.value = getOperatingRow();
}

async function saveVersionRowLocal(row: VersionEditRow): Promise<void> {
  const name = row.name.trim();
  if (!name) {
    ElMessage.warning('名称不能为空');
    return;
  }

  try {
    const record = await saveVersionRow(row);
    Object.assign(row, recordToEditRow(record));
    markDataChanged();
  } catch {
    await reloadTableAfterFailure();
  }
}

function handleCurrentRowChange(
  params: VxeTableDefines.CurrentRowChangeEventParams<VersionEditRow>,
): void {
  selectedRow.value = params.row ?? null;
}

function removeRowFromTable(rowId: string): void {
  gridOptions.data =
    gridOptions.data?.filter((item) => item.id !== rowId) ?? [];
  selectedRow.value = null;
  editingNameRowId.value = null;
}

async function handleAdd(): Promise<void> {
  const row = createEmptyRow();
  gridOptions.data = [...(gridOptions.data ?? []), row];
  selectedRow.value = row;
  await nextTick();
  gridRef.value?.setCurrentRow(row);
  await gridRef.value?.setEditCell(row, 'name');
  editingNameRowId.value = row.id;
}

async function handleDelete(): Promise<void> {
  const currentRow = getOperatingRow();
  if (!currentRow) {
    ElMessage.warning('请先选中要删除的行');
    return;
  }

  if (isTempVersionRow(currentRow)) {
    removeRowFromTable(currentRow.id);
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定删除版本「${currentRow.name}」吗？`,
      '提示',
      { type: 'warning' },
    );
  } catch {
    return;
  }

  deleting.value = true;
  try {
    await deleteVersionRow(currentRow.id);
    removeRowFromTable(currentRow.id);
    markDataChanged();
    ElMessage.success('删除成功');
  } catch {
    await reloadTableAfterFailure();
  } finally {
    deleting.value = false;
  }
}

async function handleToggleStatus(): Promise<void> {
  const currentRow = getOperatingRow();
  if (!currentRow) {
    ElMessage.warning('请先选中要操作的行');
    return;
  }

  const name = currentRow.name.trim();
  if (!name) {
    ElMessage.warning('名称不能为空');
    return;
  }

  const shouldEnable = currentRow.enabledStatus !== '已启用';

  if (isTempVersionRow(currentRow)) {
    currentRow.enabledStatus = shouldEnable ? '已启用' : '未启用';
    if (!shouldEnable) {
      return;
    }
  }

  statusToggling.value = true;
  try {
    let record: VersionRecord;
    if (isTempVersionRow(currentRow)) {
      record = await saveVersionRow(currentRow);
    } else if (shouldEnable) {
      record = await enableVersionRow(currentRow);
    } else {
      record = await disableVersionRow(currentRow);
    }
    Object.assign(currentRow, recordToEditRow(record));
    markDataChanged();
    ElMessage.success(shouldEnable ? '已启用' : '已停用');
  } catch {
    await reloadTableAfterFailure();
  } finally {
    statusToggling.value = false;
  }
}

function handleEditActived(
  params: VxeTableDefines.EditActivatedEventParams<VersionEditRow>,
): void {
  if (params.column.field === 'name') {
    editingNameRowId.value = params.row.id;
  }
}

function handleEditClosed(
  params: VxeTableDefines.EditClosedEventParams<VersionEditRow>,
): void {
  if (params.column.field !== 'name') {
    return;
  }
  editingNameRowId.value = null;
  void saveVersionRowLocal(params.row);
}

function handleClose(): void {
  emit('close', dataChanged.value);
}

onMounted(() => {
  void loadTableData();
});
</script>

<style lang="scss" scoped>
.version-edit-dialog {
  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  &__toolbar-left {
    display: flex;
    gap: 8px;
  }

  &__grid {
    width: 100%;
  }
}
</style>
