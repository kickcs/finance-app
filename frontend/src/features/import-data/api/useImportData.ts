import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { importApi } from './importApi';
import type { ParsedTransaction } from '@/shared/lib/csv/parseMoneyLoverCsv';

export function useImportData() {
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (transactions: ParsedTransaction[]) =>
      importApi.importTransactions(transactions),
    onSuccess() {
      // Invalidate all related queries so UI refreshes
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-stats'] });
    },
  });

  return {
    importMutation,
  };
}
