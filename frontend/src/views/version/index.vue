<template>
  <div class="version-page">
    <div class="version-page__toolbar">
      <el-button type="primary" @click="openEditDialog">维护版本</el-button>
      <el-select
        v-model="selectedVersionId"
        class="version-page__select"
        placeholder="请选择版本"
        clearable
        :loading="versionLoading"
        @change="handleVersionChange"
      >
        <el-option
          v-for="item in versionOptions"
          :key="item.id"
          :label="item.label"
          :value="item.id"
        />
      </el-select>
    </div>

    <VersionEditDialog
      v-if="editDialogVisible"
      @close="handleDialogClose"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { fetchVersionList } from '@/api/version';
import { useVersionStore } from '@/stores/version';
import type { VersionOption, VersionRecord } from '@/types/version';
import VersionEditDialog from './editDialog.vue';

const versionStore = useVersionStore();
const { selectedVersionId } = storeToRefs(versionStore);

const editDialogVisible = ref(false);
const versionLoading = ref(false);
const versionOptions = ref<VersionOption[]>([]);

function openEditDialog(): void {
  editDialogVisible.value = true;
}

function handleDialogClose(changed: boolean): void {
  editDialogVisible.value = false;
  if (changed) {
    void loadVersionList('refresh');
  }
}

/** 版本下拉变更时同步到 Pinia */
function handleVersionChange(value: string | null | undefined): void {
  versionStore.setSelectedVersionId(value ?? '');
}

/** 优先取第一个启用版本，否则取列表第一项 */
function pickDefaultVersionId(list: VersionRecord[]): string {
  const enabled = list.find((item) => item.status === 1);
  return enabled?.id ?? list[0]?.id ?? '';
}

/** 应用默认选中逻辑 */
function applyDefaultVersionSelection(list: VersionRecord[]): void {
  versionStore.setSelectedVersionId(pickDefaultVersionId(list));
}

function syncVersionOptions(list: VersionRecord[]): void {
  versionOptions.value = list.map((item) => ({
    id: item.id,
    label: item.name,
  }));
}

async function loadVersionList(mode: 'init' | 'refresh' = 'refresh'): Promise<void> {
  versionLoading.value = true;
  try {
    const list = await fetchVersionList();
    syncVersionOptions(list);

    if (mode === 'init') {
      applyDefaultVersionSelection(list);
      return;
    }

    const stillExists = list.some((item) => item.id === selectedVersionId.value);
    if (!stillExists) {
      applyDefaultVersionSelection(list);
    }
  } finally {
    versionLoading.value = false;
  }
}

onMounted(() => {
  void loadVersionList('init');
});
</script>

<style lang="scss" scoped>
.version-page {
  &__toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__select {
    width: 240px;
  }
}
</style>
