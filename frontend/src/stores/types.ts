import { defineStore } from 'pinia';
import { ref } from 'vue';

/** 当前选中的分类状态（供明细模块使用） */
export const useTypesStore = defineStore('types', () => {
  const selectedTypeId = ref<string>('');
  /** 当前选中分类是否为末级节点 */
  const selectedTypeIsLeaf = ref(false);
  /** 当前选中分类是否已保存（有真实 id） */
  const selectedTypeIsSaved = ref(false);
  /** 当前选中分类是否为启用状态 */
  const selectedTypeIsEnabled = ref(false);
  /** 当前是否选中「全部行」（展示所有分类下的明细） */
  const selectedTypeIsAll = ref(false);
  /** 明细列表刷新信号（分类状态变更时递增） */
  const detailsRefreshSeed = ref(0);

  /** 设置当前选中分类 */
  function setSelectedTypeId(
    id: string,
    isLeaf = false,
    isSaved = true,
    isEnabled = true,
  ): void {
    selectedTypeIsAll.value = false;
    selectedTypeId.value = id;
    selectedTypeIsLeaf.value = isLeaf;
    selectedTypeIsSaved.value = isSaved;
    selectedTypeIsEnabled.value = isEnabled;
  }

  /** 选中「全部行」：明细模块展示全部明细，不可新增 */
  function setSelectedTypeAll(): void {
    selectedTypeIsAll.value = true;
    selectedTypeId.value = '';
    selectedTypeIsLeaf.value = false;
    selectedTypeIsSaved.value = false;
    selectedTypeIsEnabled.value = false;
  }

  /** 清空当前选中分类 */
  function clearSelectedTypeId(): void {
    selectedTypeIsAll.value = false;
    selectedTypeId.value = '';
    selectedTypeIsLeaf.value = false;
    selectedTypeIsSaved.value = false;
    selectedTypeIsEnabled.value = false;
  }

  /** 通知明细模块刷新列表（分类废弃/启用等级联变更后调用） */
  function notifyDetailsRefresh(): void {
    detailsRefreshSeed.value += 1;
  }

  return {
    selectedTypeId,
    selectedTypeIsLeaf,
    selectedTypeIsSaved,
    selectedTypeIsEnabled,
    selectedTypeIsAll,
    detailsRefreshSeed,
    setSelectedTypeId,
    setSelectedTypeAll,
    clearSelectedTypeId,
    notifyDetailsRefresh,
  };
});
