import { ref, computed } from 'vue';
import type { Transaction } from '@/entities/transaction';
import { getCategoryById } from '@/entities/category';

export function useSearch(transactions: () => Transaction[]) {
  const query = ref('');
  const isSearching = ref(false);

  const filteredTransactions = computed(() => {
    const txs = transactions();
    if (!query.value.trim()) return txs;

    const searchTerm = query.value.toLowerCase().trim();

    return txs.filter((tx) => {
      const category = getCategoryById(tx.category_id);
      const categoryMatch = category?.name.toLowerCase().includes(searchTerm);
      const descriptionMatch = tx.description
        ?.toLowerCase()
        .includes(searchTerm);
      const amountMatch = String(tx.amount).includes(searchTerm);

      return categoryMatch || descriptionMatch || amountMatch;
    });
  });

  const hasResults = computed(() => filteredTransactions.value.length > 0);
  const isEmpty = computed(
    () => query.value.trim() !== '' && !hasResults.value,
  );

  function setQuery(newQuery: string) {
    query.value = newQuery;
    isSearching.value = newQuery.trim() !== '';
  }

  function clearSearch() {
    query.value = '';
    isSearching.value = false;
  }

  return {
    query,
    isSearching,
    filteredTransactions,
    hasResults,
    isEmpty,
    setQuery,
    clearSearch,
  };
}
