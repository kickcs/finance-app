import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { importedTransactionsApi } from './importedTransactionsApi';
import { importedTransactionQueryKeys } from './queryKeys';

export function useTelegramCards(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();
  const enabled = computed(() => Boolean(toValue(userId)));

  const cardsQuery = useQuery({
    queryKey: computed(() => importedTransactionQueryKeys.cards(toValue(userId) ?? '')),
    queryFn: () => importedTransactionsApi.getCards(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: importedTransactionQueryKeys.all });

  const setMutation = useMutation({
    mutationFn: ({ cardMask, accountId }: { cardMask: string; accountId: string }) =>
      importedTransactionsApi.setCardAccount(cardMask, accountId),
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (cardMask: string) => importedTransactionsApi.deleteCardMapping(cardMask),
    onSettled: invalidate,
  });

  return {
    cards: computed(() => cardsQuery.data.value ?? []),
    isLoading: cardsQuery.isLoading,
    setCardAccount: (cardMask: string, accountId: string) =>
      setMutation.mutateAsync({ cardMask, accountId }),
    deleteCardMapping: (cardMask: string) => deleteMutation.mutateAsync(cardMask),
  };
}
