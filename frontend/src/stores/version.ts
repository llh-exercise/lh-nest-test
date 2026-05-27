import { defineStore } from 'pinia';
import { ref } from 'vue';

/** 当前选中的版本状态 */
export const useVersionStore = defineStore('version', () => {
  const selectedVersionId = ref<string>('');

  /** 设置当前选中版本 */
  function setSelectedVersionId(id: string): void {
    selectedVersionId.value = id;
  }

  /** 清空当前选中版本 */
  function clearSelectedVersionId(): void {
    selectedVersionId.value = '';
  }

  return {
    selectedVersionId,
    setSelectedVersionId,
    clearSelectedVersionId,
  };
});
