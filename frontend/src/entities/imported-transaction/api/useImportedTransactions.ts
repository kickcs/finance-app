import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { importedTransactionsApi } from './importedTransactionsApi';
import { importedTransactionQueryKeys } from './queryKeys';
import type { ImportedTransaction } from '../model/types';

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

  // Точечное удаление из кэша вместо инвалидации: полный рефетч инбокса
  // перерисовывал страницу подтверждения («моргание» между импортами).
  const removeFromInbox = (id: string) => {
    queryClient.setQueryData<{ items: ImportedTransaction[]; count: number }>(
      queryKey.value,
      (old) =>
        old
          ? { items: old.items.filter((i) => i.id !== id), count: Math.max(0, old.count - 1) }
          : old,
    );
  };

  const confirmMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { transactionId: string; accountId: string; toAccountId?: string };
    }) => importedTransactionsApi.confirm(id, payload),
    onSuccess: (_res, { id }) => {
      removeFromInbox(id);
      // confirm мог обновить маппинг карта→счёт — точечно освежаем только его.
      queryClient.invalidateQueries({
        queryKey: importedTransactionQueryKeys.cards(toValue(userId) ?? ''),
      });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => importedTransactionsApi.dismiss(id),
    onSuccess: (_res, id) => removeFromInbox(id),
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
