import { ref, computed, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';

const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 300;

/**
 * Строка поиска с дебаунсом. Своего запроса нет: запрос становится фильтром `search`
 * той же ленты, итога и массовой правки — иначе они разошлись бы с найденным.
 */
export function useSearchTerm() {
  const searchTerm = ref('');
  const debouncedTerm = ref('');

  const updateDebounced = useDebounceFn((value: string) => {
    debouncedTerm.value = value;
  }, DEBOUNCE_MS);

  watch(searchTerm, (value) => updateDebounced(value.trim()));

  const isSearchActive = computed(() => debouncedTerm.value.length >= MIN_SEARCH_LENGTH);

  function setQuery(value: string) {
    searchTerm.value = value;
  }

  function clearSearch() {
    searchTerm.value = '';
    debouncedTerm.value = '';
  }

  return {
    searchTerm,
    /** Запрос после дебаунса — им меняется набор результатов, а не вводом */
    debouncedTerm,
    isSearchActive,
    setQuery,
    clearSearch,
  };
}
