import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { importedTransactionsApi } from './importedTransactionsApi';
import { importedTransactionQueryKeys } from './queryKeys';

export function useTelegramLink(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();
  const enabled = computed(() => Boolean(toValue(userId)));

  const statusQuery = useQuery({
    queryKey: computed(() => importedTransactionQueryKeys.link(toValue(userId) ?? '')),
    queryFn: () => importedTransactionsApi.getLinkStatus(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: importedTransactionQueryKeys.all });

  const createTokenMutation = useMutation({
    mutationFn: () => importedTransactionsApi.createLinkToken(),
  });

  const unlinkMutation = useMutation({
    mutationFn: () => importedTransactionsApi.unlink(),
    onSettled: invalidate,
  });

  return {
    status: computed(() => statusQuery.data.value ?? null),
    isLoading: statusQuery.isLoading,
    refetchStatus: statusQuery.refetch,
    createLinkToken: () => createTokenMutation.mutateAsync(),
    unlink: () => unlinkMutation.mutateAsync(),
    isUnlinking: unlinkMutation.isPending,
  };
}
