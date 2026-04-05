import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { recurringSubscriptionQueryKeys } from './queryKeys';
import { recurringSubscriptionApi } from './recurringSubscriptionApi';

export function useSubscriptionCalendar(
  userId: MaybeRefOrGetter<string | null>,
  month: MaybeRefOrGetter<string>, // "2026-04"
) {
  const queryKey = computed(() => {
    const uid = toValue(userId);
    const m = toValue(month);
    return uid
      ? recurringSubscriptionQueryKeys.calendar(uid, m)
      : recurringSubscriptionQueryKeys.all;
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKey,
    queryFn: () => {
      const uid = toValue(userId);
      if (!uid) return [];
      return recurringSubscriptionApi.getCalendar(uid, toValue(month));
    },
    enabled: computed(() => !!toValue(userId)),
  });

  const calendarEntries = computed(() => data.value ?? []);

  return {
    calendarEntries,
    isLoading,
    error,
    refetch,
  };
}
