import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { transactionQueryKeys } from './queryKeys';
import { transactionsApi } from './transactionsApi';

export function useHashtags(userId: MaybeRefOrGetter<string | null>) {
  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? transactionQueryKeys.hashtags(uid) : transactionQueryKeys.all;
  });

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => transactionsApi.getHashtags(),
    enabled: computed(() => !!toValue(userId)),
    staleTime: 5 * 60 * 1000,
  });

  const hashtags = computed(() => data.value ?? []);

  return { hashtags, isLoading };
}
