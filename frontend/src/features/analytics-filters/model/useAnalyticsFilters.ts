import { ref, computed } from 'vue';
import type { AccountFilters } from './types';

export function useAnalyticsFilters() {
  const filters = ref<AccountFilters>({
    selectedAccountIds: [],
  });

  function toggleAccount(accountId: string) {
    const index = filters.value.selectedAccountIds.indexOf(accountId);
    if (index === -1) {
      filters.value.selectedAccountIds.push(accountId);
    } else {
      filters.value.selectedAccountIds.splice(index, 1);
    }
  }

  function clearAccountFilters() {
    filters.value.selectedAccountIds = [];
  }

  const activeFilterCount = computed(() => {
    return filters.value.selectedAccountIds.length > 0 ? 1 : 0;
  });

  return {
    filters,
    activeFilterCount,
    toggleAccount,
    clearAccountFilters,
  };
}
