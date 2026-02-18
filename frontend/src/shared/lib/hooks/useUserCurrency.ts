import { computed } from 'vue';

export function useUserCurrency() {
  const currency = computed(
    () => localStorage.getItem('selectedCurrency') || 'UZS',
  );

  return {
    currency,
  };
}
