import { defineStore } from 'pinia';
import { ref } from 'vue';

/** 当前选中的分类状态（供明细模块使用） */
export const useTypesStore = defineStore('types', () => {
  const selectedTypeId = ref<string>('');
  /** 当前选中分类是否为末级节点 */
  const selectedTypeIsLeaf = ref(false);

  /** 设置当前选中分类 */
  function setSelectedTypeId(id: string, isLeaf = false): void {
    selectedTypeId.value = id;
    selectedTypeIsLeaf.value = isLeaf;
  }

  /** 清空当前选中分类 */
  function clearSelectedTypeId(): void {
    selectedTypeId.value = '';
    selectedTypeIsLeaf.value = false;
  }

  return {
    selectedTypeId,
    selectedTypeIsLeaf,
    setSelectedTypeId,
    clearSelectedTypeId,
  };
});
