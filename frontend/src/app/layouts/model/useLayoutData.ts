import { computed } from 'vue';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useProfile } from '@/shared/api/composables/useProfile';
import { useExchangeRates } from '@/shared/api/composables/useExchangeRates';
import { useAccounts } from '@/entities/account/api';
import { useLocalStorage } from '@vueuse/core';
import { getGreeting } from '@/shared/lib/format/greeting';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

export function useLayoutData() {
  const { userId } = useCurrentUser();
  const { profile } = useProfile(userId);
  const { accounts, isLoading: accountsLoading } = useAccounts(userId);

  const currency = computed(() => profile.value?.currency ?? 'USD');
  const userName = computed(() => profile.value?.name ?? '');
  const greeting = getGreeting();

  const { convert, isLoading: ratesLoading } = useExchangeRates(currency);

  const hiddenAccountIds = computed<Set<string>>(
    () => new Set(profile.value?.dashboard_settings?.hidden_account_ids ?? []),
  );

  const totalBalance = computed(() => {
    const filteredByCurrency: Record<string, number> = {};
    for (const account of accounts.value) {
      if (hiddenAccountIds.value.has(account.id)) continue;
      for (const balance of account.balances) {
        filteredByCurrency[balance.currency] =
          (filteredByCurrency[balance.currency] ?? 0) + balance.balance;
      }
    }
    let total = 0;
    for (const [curr, amount] of Object.entries(filteredByCurrency)) {
      total += convert(amount, curr);
    }
    return total;
  });

  const isHidden = useLocalStorage(STORAGE_KEYS.BALANCE_HIDDEN, false);

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
