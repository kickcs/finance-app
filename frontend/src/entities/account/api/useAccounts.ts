import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { accountQueryKeys } from './queryKeys';
import { accountsApi } from './accountsApi';
import type {
  Account,
  AccountInsert,
  AccountWithBalances,
} from '@/shared/api/database.types';

export function useAccounts(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? accountQueryKeys.list(uid) : accountQueryKeys.all;
  });

  // Main query - now fetches accounts with balances
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKey,
    queryFn: () => {
      const uid = toValue(userId);
      if (!uid) return [];
      return accountsApi.getAllWithBalances(uid);
    },
    enabled: computed(() => !!toValue(userId)),
  });

  const accounts = computed<AccountWithBalances[]>(() => data.value ?? []);

  // Create mutation with balances
  const createWithBalancesMutation = useMutation({
    mutationFn: ({
      account,
      balances,
    }: {
      account: Omit<AccountInsert, 'user_id' | 'balance' | 'currency'>;
      balances: Array<{ currency: string; balance: number }>;
    }) => {
      const uid = toValue(userId);
      if (!uid) throw new Error('User not authenticated');
      return accountsApi.createWithBalances(
        { ...account, user_id: uid },
        balances,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Legacy create mutation (for backward compatibility)
  const createMutation = useMutation({
    mutationFn: (account: Omit<AccountInsert, 'user_id'>) => {
      const uid = toValue(userId);
      if (!uid) throw new Error('User not authenticated');
      const balances =
        account.currency && account.balance !== undefined
          ? [{ currency: account.currency, balance: account.balance }]
          : [{ currency: account.currency ?? 'UZS', balance: 0 }];
      return accountsApi.createWithBalances(
        { ...account, user_id: uid },
        balances,
      );
    },
    onMutate: async (newAccount) => {
      const uid = toValue(userId);
      if (!uid) return;

      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousAccounts = queryClient.getQueryData<AccountWithBalances[]>(
        queryKey.value,
      );

      const optimisticAccount: AccountWithBalances = {
        id: `temp-${Date.now()}`,
        user_id: uid,
        created_at: new Date().toISOString(),
        order: (previousAccounts?.length ?? 0) + 1,
        name: newAccount.name,
        icon: newAccount.icon,
        color: newAccount.color,
        type: newAccount.type ?? 'basic',
        balances: [
          {
            id: 'temp',
            account_id: 'temp',
            currency: newAccount.currency,
            balance: newAccount.balance ?? 0,
            created_at: new Date().toISOString(),
          },
        ],
        credit_limit: newAccount.credit_limit ?? null,
        grace_period_days: newAccount.grace_period_days ?? null,
        billing_day: newAccount.billing_day ?? null,
        total_amount: newAccount.total_amount ?? null,
        interest_rate: newAccount.interest_rate ?? null,
        monthly_payment: newAccount.monthly_payment ?? null,
        start_date: newAccount.start_date ?? null,
        end_date: newAccount.end_date ?? null,
        maturity_date: newAccount.maturity_date ?? null,
        is_replenishable: newAccount.is_replenishable ?? null,
        is_withdrawable: newAccount.is_withdrawable ?? null,
      };

      queryClient.setQueryData<AccountWithBalances[]>(queryKey.value, (old) => [
        ...(old ?? []),
        optimisticAccount,
      ]);

      return { previousAccounts };
    },
    onError: (_err, _newAccount, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(queryKey.value, context.previousAccounts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Account> }) =>
      accountsApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousAccounts = queryClient.getQueryData<AccountWithBalances[]>(
        queryKey.value,
      );

      queryClient.setQueryData<AccountWithBalances[]>(
        queryKey.value,
        (old) =>
          old?.map((a) => (a.id === id ? { ...a, ...updates } : a)) ?? [],
      );

      return { previousAccounts };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(queryKey.value, context.previousAccounts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountsApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousAccounts = queryClient.getQueryData<AccountWithBalances[]>(
        queryKey.value,
      );

      queryClient.setQueryData<AccountWithBalances[]>(
        queryKey.value,
        (old) => old?.filter((a) => a.id !== id) ?? [],
      );

      return { previousAccounts };
    },
    onError: (_err, _id, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(queryKey.value, context.previousAccounts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Computed values
  const totalBalance = computed(() => {
    // Sum all balances (without conversion - for simple display)
    return accounts.value.reduce((sum, acc) => {
      return sum + acc.balances.reduce((bSum, b) => bSum + b.balance, 0);
    }, 0);
  });

  // Get total balance by currency (for display breakdown)
  const totalBalancesByCurrency = computed(() => {
    const totals: Record<string, number> = {};
    for (const account of accounts.value) {
      for (const balance of account.balances) {
        totals[balance.currency] =
          (totals[balance.currency] ?? 0) + balance.balance;
      }
    }
    return totals;
  });

  // Helper functions
  function getAccountById(id: string): AccountWithBalances | undefined {
    return accounts.value.find((a) => a.id === id);
  }

  async function createAccount(account: Omit<AccountInsert, 'user_id'>) {
    return createMutation.mutateAsync(account);
  }

  async function createAccountWithBalances(
    account: Omit<AccountInsert, 'user_id' | 'balance' | 'currency'>,
    balances: Array<{ currency: string; balance: number }>,
  ) {
    return createWithBalancesMutation.mutateAsync({ account, balances });
  }

  async function updateAccount(id: string, updates: Partial<Account>) {
    return updateMutation.mutateAsync({ id, updates });
  }

  async function updateBalance(id: string, amount: number) {
    const account = getAccountById(id);
    if (!account) throw new Error('Account not found');
    // Legacy: update first balance
    const firstBalance = account.balances[0];
    if (firstBalance) {
      return updateAccount(id, { balance: firstBalance.balance + amount });
    }
    throw new Error('No balance found');
  }

  async function deleteAccount(id: string) {
    return deleteMutation.mutateAsync(id);
  }

  return {
    accounts,
    isLoading,
    error,
    totalBalance,
    totalBalancesByCurrency,
    createAccount,
    createAccountWithBalances,
    updateAccount,
    updateBalance,
    deleteAccount,
    getAccountById,
    refetch,
  };
}
