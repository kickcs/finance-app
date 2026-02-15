import { ref, computed } from 'vue';
import { CURRENCIES, type Currency } from '@/entities/currency';

export function useCurrencySelection() {
  const searchQuery = ref('');
  const selectedCurrency = ref<Currency | null>(null);

  const filteredCurrencies = computed(() => {
    if (!searchQuery.value) return CURRENCIES;

    const query = searchQuery.value.toLowerCase();
    return CURRENCIES.filter(
      (currency) =>
        currency.code.toLowerCase().includes(query) ||
        currency.name.toLowerCase().includes(query) ||
        currency.symbol.includes(query),
    );
  });

  function selectCurrency(currency: Currency) {
    selectedCurrency.value = currency;
  }

  function clearSelection() {
    selectedCurrency.value = null;
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query;
  }

  return {
    searchQuery,
    selectedCurrency,
    filteredCurrencies,
    selectCurrency,
    clearSelection,
    setSearchQuery,
  };
}
