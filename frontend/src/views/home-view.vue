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
      <DetailsPanel />
    </main>
  </div>
</template>

<script setup lang="ts">
import VersionPanel from '@/views/version/index.vue';
import TypesPanel from '@/views/types/index.vue';
import DetailsPanel from '@/views/details/index.vue';
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
    min-width: 0;
    border: 1px dashed var(--el-border-color);
    border-radius: 4px;
    padding: 12px;
    background-color: var(--el-fill-color-blank);
  }
}
</style>
