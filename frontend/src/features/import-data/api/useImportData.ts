import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { importApi } from './importApi';
import { transactionQueryKeys } from '@/entities/transaction';
import { accountQueryKeys } from '@/entities/account';
import { accountBalanceQueryKeys } from '@/entities/account-balance';
import { categoryQueryKeys } from '@/entities/category';
import type { ParsedTransaction } from '@/shared/lib/csv/parseMoneyLoverCsv';

export function useImportData() {
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (transactions: ParsedTransaction[]) => importApi.importTransactions(transactions),
    onSuccess() {
      // Invalidate all related queries so UI refreshes
      // Using .all prefix keys to cover all sub-queries
      queryClient.invalidateQueries({ queryKey: transactionQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: accountBalanceQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all });
    },
  });

  return {
    importMutation,
  };
}
