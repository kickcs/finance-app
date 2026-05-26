import { useQuery } from '@tanstack/react-query';

import { transactionsApi } from './transactionsApi';
import { transactionKeys } from './queryKeys';

export function useTransactions(userId: string | null, limit = 50) {
  return useQuery({
    queryKey: transactionKeys.list(userId ?? '__disabled__', limit),
    queryFn: () => transactionsApi.getAll(limit),
    enabled: !!userId,
  });
}

export function useRecentTransactions(userId: string | null, limit = 5) {
  return useQuery({
    queryKey: transactionKeys.recent(userId ?? '__disabled__', limit),
    queryFn: () => transactionsApi.getAll(limit),
    enabled: !!userId,
  });
}

export function useTransaction(id: string | null) {
  return useQuery({
    queryKey: transactionKeys.detail(id ?? '__disabled__'),
    queryFn: () => {
      if (!id) throw new Error('id is required');
      return transactionsApi.getById(id);
    },
    enabled: !!id,
  });
}
