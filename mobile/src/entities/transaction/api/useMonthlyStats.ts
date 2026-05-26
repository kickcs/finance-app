import { useQuery } from '@tanstack/react-query';

import { transactionsApi } from './transactionsApi';
import { transactionKeys } from './queryKeys';

interface Options {
  year?: number;
  month?: number;
}

export function useMonthlyStats(userId: string | null, options: Options = {}) {
  const now = new Date();
  const year = options.year ?? now.getFullYear();
  const month = options.month ?? now.getMonth() + 1;

  return useQuery({
    queryKey: transactionKeys.monthly(userId ?? '__disabled__', year, month),
    queryFn: () => transactionsApi.getMonthlyStats(year, month),
    enabled: !!userId,
  });
}
