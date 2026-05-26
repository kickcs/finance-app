import { useQuery } from '@tanstack/react-query';

import { accountsApi } from './accountsApi';
import { accountKeys } from './queryKeys';

export function useAccounts(userId: string | null) {
  return useQuery({
    queryKey: accountKeys.byUser(userId ?? '__disabled__'),
    queryFn: accountsApi.getAll,
    enabled: !!userId,
  });
}

export function useAccountsWithBalances(userId: string | null) {
  return useQuery({
    queryKey: accountKeys.withBalances(userId ?? '__disabled__'),
    queryFn: accountsApi.getAllWithBalances,
    enabled: !!userId,
  });
}

export function useAccount(userId: string | null, accountId: string | null) {
  return useQuery({
    queryKey: accountKeys.detail(userId ?? '__disabled__', accountId ?? '__disabled__'),
    queryFn: () => {
      if (!accountId) throw new Error('accountId is required');
      return accountsApi.getById(accountId);
    },
    enabled: !!userId && !!accountId,
  });
}
