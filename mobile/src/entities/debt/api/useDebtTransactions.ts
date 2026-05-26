import { useQuery } from '@tanstack/react-query';

import { http } from '@/shared/api/http';
import type { Transaction } from '@/shared/api/database.types';

import { debtKeys } from './queryKeys';

type TransactionsResponse = {
  data: Transaction[];
  nextCursor: unknown;
  hasMore: boolean;
};

export function useDebtTransactions(debtId: string | null) {
  return useQuery({
    queryKey: debtKeys.transactions(debtId ?? '__disabled__'),
    queryFn: async () => {
      const res = await http<TransactionsResponse>(
        `/api/transactions?debtId=${debtId}&pageSize=100`,
      );
      return [...res.data].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    },
    enabled: !!debtId,
  });
}
