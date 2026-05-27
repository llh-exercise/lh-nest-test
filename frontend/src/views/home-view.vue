<template>
  <div class="home-view">
    <aside class="home-view__left">
      <section class="home-view__left-top">
        <VersionPanel />
      </section>
      <section class="home-view__left-bottom">
        <TypesPanel />
      </section>
    </aside>

    <main class="home-view__right">
      <div class="home-view__toolbar">
        显示name<vxe-switch v-model="showName" />
        显示address<vxe-switch v-model="showAddress" />
      </div>
      <vxe-grid :columns="tableColumn" :data="tableData" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { VxeGridPropTypes } from 'vxe-table';
import VersionPanel from '@/views/version/index.vue';
import TypesPanel from '@/views/types/index.vue';

interface RowVO {
  id: number;
  name: string;
  role: string;
  sex: string;
  age: number;
  address: string;
}

const showName = ref(true);
const showAddress = ref(true);

const tableColumn = computed(() => {
  const defCols: VxeGridPropTypes.Columns<RowVO> = [
    { type: 'seq', width: 70 },
    { field: 'sex', title: 'Sex' },
    { field: 'age', title: 'Age' },
  ];
  if (showName.value) {
    defCols.splice(1, 0, { field: 'name', title: 'Name' });
  }
  if (showAddress.value) {
    defCols.push({ field: 'address', title: 'Address' });
  }
  return defCols;
});

const tableData = ref<RowVO[]>([
  {
    id: 10001,
    name: 'Test1',
    role: 'Develop',
    sex: 'Man',
    age: 28,
    address: 'test abc',
  },
  {
    id: 10002,
    name: 'Test2',
    role: 'Test',
    sex: 'Women',
    age: 22,
    address: 'Guangzhou',
  },
  {
    id: 10003,
    name: 'Test3',
    role: 'PM',
    sex: 'Man',
    age: 32,
    address: 'Shanghai',
  },
  {
    id: 10004,
    name: 'Test4',
    role: 'Designer',
    sex: 'Women',
    age: 24,
    address: 'Shanghai',
  },
]);
</script>

<style lang="scss" scoped>
.home-view {
  display: flex;
  gap: 16px;
  min-height: 100vh;
  padding: 16px;
  box-sizing: border-box;

  &__left {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: 320px;
    gap: 12px;
  }

  &__left-top {
    flex-shrink: 0;
  }

  &__left-bottom {
    flex: 1;
    min-height: 120px;
    border: 1px dashed var(--el-border-color);
    border-radius: 4px;
    background-color: var(--el-fill-color-blank);
  }

  &__right {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }
}
</style>
