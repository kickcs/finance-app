import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { importedTransactionsApi } from './importedTransactionsApi';
import { importedTransactionQueryKeys } from './queryKeys';

export function useImportedTransactions(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();
  const enabled = computed(() => Boolean(toValue(userId)));
  const queryKey = computed(() => importedTransactionQueryKeys.inbox(toValue(userId) ?? ''));

  const inboxQuery = useQuery({
    queryKey,
    queryFn: () => importedTransactionsApi.getInbox(),
    enabled,
    // Poll while the tab is active so freshly forwarded operations surface on
    // their own (the History banner reads this same query). Vue Query keeps
    // refetchIntervalInBackground false by default — no polling on hidden tabs.
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const items = computed(() => inboxQuery.data.value?.items ?? []);
  const pendingCount = computed(() => inboxQuery.data.value?.count ?? 0);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: importedTransactionQueryKeys.all });

  const confirmMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { transactionId: string; accountId: string; toAccountId?: string };
    }) => importedTransactionsApi.confirm(id, payload),
    onSettled: invalidate,
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => importedTransactionsApi.dismiss(id),
    onSettled: invalidate,
  });

  return {
    items,
    pendingCount,
    isLoading: inboxQuery.isLoading,
    error: inboxQuery.error,
    refetch: inboxQuery.refetch,
    confirmImported: (
      id: string,
      payload: { transactionId: string; accountId: string; toAccountId?: string },
    ) => confirmMutation.mutateAsync({ id, payload }),
    dismissImported: (id: string) => dismissMutation.mutateAsync(id),
    isConfirming: confirmMutation.isPending,
    isDismissing: dismissMutation.isPending,
  };
}
