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
import { fetchVersionList } from '@/api/version';
import type { VersionOption, VersionRecord } from '@/types/version';
import VersionEditDialog from './editDialog.vue';

const editDialogVisible = ref(false);
const versionLoading = ref(false);
const selectedVersionId = ref<string>('');
const versionOptions = ref<VersionOption[]>([]);

function openEditDialog(): void {
  editDialogVisible.value = true;
}

function handleDialogClose(changed: boolean): void {
  editDialogVisible.value = false;
  if (changed) {
    void loadVersionList();
  }
}

function syncVersionOptions(list: VersionRecord[]): void {
  versionOptions.value = list.map((item) => ({
    id: item.id,
    label: item.name,
  }));
  if (
    selectedVersionId.value &&
    !list.some((item) => item.id === selectedVersionId.value)
  ) {
    selectedVersionId.value = '';
  }
}

async function loadVersionList(): Promise<void> {
  versionLoading.value = true;
  try {
    const list = await fetchVersionList();
    syncVersionOptions(list);
  } finally {
    versionLoading.value = false;
  }
}

onMounted(() => {
  void loadVersionList();
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
