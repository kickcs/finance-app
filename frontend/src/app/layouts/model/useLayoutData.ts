import { computed } from 'vue';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useProfile, useExchangeRates } from '@/shared/api';
import { useAccounts } from '@/entities/account';
import { useLocalStorage } from '@vueuse/core';
import { getGreeting } from '@/shared/lib/format/greeting';

export function useLayoutData() {
  const { userId } = useCurrentUser();
  const { profile } = useProfile(userId);
  const { totalBalancesByCurrency, isLoading: accountsLoading } = useAccounts(userId);

  const currency = computed(() => profile.value?.currency ?? 'USD');
  const userName = computed(() => profile.value?.name ?? '');
  const greeting = getGreeting();

  const { convert, isLoading: ratesLoading } = useExchangeRates(currency);

  const totalBalance = computed(() => {
    return Object.entries(totalBalancesByCurrency.value).reduce((sum, [curr, amount]) => {
      return sum + convert(amount, curr);
    }, 0);
  });

  const isHidden = useLocalStorage('balance_hidden', false);

  function toggleHidden() {
    isHidden.value = !isHidden.value;
  }

  return {
    userId,
    userName,
    greeting,
    currency,
    totalBalance,
    isHidden,
    toggleHidden,
    isLoading: computed(() => accountsLoading.value || ratesLoading.value),
  };
}
