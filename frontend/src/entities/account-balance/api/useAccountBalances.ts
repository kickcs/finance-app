import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { accountBalancesApi } from './accountBalancesApi';
import { accountBalanceQueryKeys } from './queryKeys';
import type { AccountBalance } from '@/shared/api/database.types';

export function useAccountBalances(accountId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const id = toValue(accountId);
    return id
      ? accountBalanceQueryKeys.byAccount(id)
      : accountBalanceQueryKeys.all;
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => {
      const id = toValue(accountId);
      if (!id) return [];
      return accountBalancesApi.getByAccountId(id);
    },
    enabled: computed(() => !!toValue(accountId)),
  });

  const upsertMutation = useMutation({
    mutationFn: ({
      currency,
      balance,
    }: {
      currency: string;
      balance: number;
    }) => {
      const id = toValue(accountId);
      if (!id) throw new Error('Account ID is required');
      return accountBalancesApi.upsert(id, currency, balance);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  const updateByDeltaMutation = useMutation({
    mutationFn: ({ currency, delta }: { currency: string; delta: number }) => {
      const id = toValue(accountId);
      if (!id) throw new Error('Account ID is required');
      return accountBalancesApi.updateByDelta(id, currency, delta);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (currency: string) => {
      const id = toValue(accountId);
      if (!id) throw new Error('Account ID is required');
      return accountBalancesApi.delete(id, currency);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Computed helpers
  const balances = computed<AccountBalance[]>(() => data.value ?? []);

  const totalInCurrency = computed(() => {
    return (currency: string) => {
      const balance = balances.value.find((b) => b.currency === currency);
      return balance?.balance ?? 0;
    };
  });

  const currencies = computed(() => balances.value.map((b) => b.currency));

  // Actions
  async function upsertBalance(currency: string, balance: number) {
    return upsertMutation.mutateAsync({ currency, balance });
  }

  async function updateBalanceByDelta(currency: string, delta: number) {
    return updateByDeltaMutation.mutateAsync({ currency, delta });
  }

  async function deleteCurrency(currency: string) {
    return deleteMutation.mutateAsync(currency);
  }

  return {
    balances,
    currencies,
    isLoading,
    error,
    refetch,
    totalInCurrency,
    upsertBalance,
    updateBalanceByDelta,
    deleteCurrency,
    isUpserting: upsertMutation.isPending,
    isUpdating: updateByDeltaMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
