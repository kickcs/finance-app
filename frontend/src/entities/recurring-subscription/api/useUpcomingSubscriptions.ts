import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { recurringSubscriptionQueryKeys } from './queryKeys';
import { recurringSubscriptionApi } from './recurringSubscriptionApi';

export function useUpcomingSubscriptions(
  userId: MaybeRefOrGetter<string | null>,
  days: number = 7,
) {
  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid
      ? recurringSubscriptionQueryKeys.upcoming(uid, days)
      : recurringSubscriptionQueryKeys.all;
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKey,
    queryFn: () => {
      const uid = toValue(userId);
      if (!uid) return [];
      return recurringSubscriptionApi.getUpcoming(uid, days);
    },
    enabled: computed(() => !!toValue(userId)),
  });

  const upcoming = computed(() => data.value ?? []);

  return {
    upcoming,
    isLoading,
    error,
    refetch,
  };
}
