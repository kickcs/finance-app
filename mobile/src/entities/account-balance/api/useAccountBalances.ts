import { useQuery } from '@tanstack/react-query';

import { accountBalancesApi } from './accountBalancesApi';
import { accountBalanceKeys } from './queryKeys';

export function useAccountBalances(accountId: string | null) {
  return useQuery({
    queryKey: accountBalanceKeys.byAccount(accountId ?? '__disabled__'),
    queryFn: () => {
      if (!accountId) throw new Error('accountId is required');
      return accountBalancesApi.getByAccountId(accountId);
    },
    enabled: !!accountId,
  });
}
