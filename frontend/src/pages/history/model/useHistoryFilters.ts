import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { useSessionStorage } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import {
  ALL_CATEGORIES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  DEBT_CATEGORIES,
  TRANSFER_CATEGORY,
  useCategories,
} from '@/entities/category';
import type { TransactionFilters } from '@/entities/transaction';

export type TypeFilter = 'all' | 'income' | 'expense' | 'transfer' | 'debt';

export const TYPE_FILTER_ITEMS = [
  { id: 'all', label: 'Все' },
  { id: 'expense', label: 'Расходы' },
  { id: 'income', label: 'Доходы' },
  { id: 'transfer', label: 'Переводы' },
  { id: 'debt', label: 'Долги' },
];

export function useHistoryFilters(userId: MaybeRefOrGetter<string | null>) {
  // Фильтры переживают уход со страницы до конца сессии; новый запуск начинает с «Все».
  const stored = useSessionStorage(STORAGE_KEYS.HISTORY_FILTERS, {
    type: 'all' as TypeFilter,
    accountId: null as string | null,
    categoryId: null as string | null,
  });
  const activeTypeFilter = computed({
    get: () => stored.value.type,
    set: (type: TypeFilter) => (stored.value = { ...stored.value, type }),
  });
  const selectedAccountId = computed({
    get: () => stored.value.accountId,
    set: (accountId: string | null) => (stored.value = { ...stored.value, accountId }),
  });
  const selectedCategoryId = computed({
    get: () => stored.value.categoryId,
    set: (categoryId: string | null) => (stored.value = { ...stored.value, categoryId }),
  });

  const activeFiltersCount = computed(() => {
    let count = 0;
    if (selectedAccountId.value) count++;
    if (selectedCategoryId.value) count++;
    return count;
  });

  const serverFilters = computed<TransactionFilters>(() => ({
    type: activeTypeFilter.value !== 'all' ? activeTypeFilter.value : undefined,
    accountId: selectedAccountId.value ?? undefined,
    categoryId: selectedCategoryId.value ?? undefined,
  }));

  function handleTypeFilterChange(val: string) {
    activeTypeFilter.value = val as TypeFilter;
    selectedCategoryId.value = null;
  }

  function clearAdditionalFilters() {
    selectedAccountId.value = null;
    selectedCategoryId.value = null;
  }

  function resetAll() {
    activeTypeFilter.value = 'all';
    clearAdditionalFilters();
  }

  // User categories from API + fallback to static
  const {
    allCategories: userCategories,
    expenseCategories: userExpenseCategories,
    incomeCategories: userIncomeCategories,
    isLoading: isLoadingCategories,
  } = useCategories(userId);

  const usedCategories = computed(() => {
    const uid = toValue(userId);
    const useDefaults = isLoadingCategories.value || (!uid && userCategories.value.length === 0);

    switch (activeTypeFilter.value) {
      case 'expense':
        return useDefaults ? EXPENSE_CATEGORIES : userExpenseCategories.value;
      case 'income':
        return useDefaults ? INCOME_CATEGORIES : userIncomeCategories.value;
      case 'debt':
        return DEBT_CATEGORIES;
      case 'transfer':
        return [TRANSFER_CATEGORY];
      case 'all':
      default:
        return useDefaults ? ALL_CATEGORIES : userCategories.value;
    }
  });

  return {
    activeTypeFilter,
    selectedAccountId,
    selectedCategoryId,
    activeFiltersCount,
    serverFilters,
    usedCategories,
    handleTypeFilterChange,
    clearAdditionalFilters,
    resetAll,
  };
}
