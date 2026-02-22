import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { subscriptionQueryKeys } from './queryKeys';
import { subscriptionApi } from './subscriptionApi';
import type { SubscriptionStatus } from '../model/types';

export function useSubscription(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? subscriptionQueryKeys.status(uid) : subscriptionQueryKeys.all;
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => subscriptionApi.getStatus(),
    enabled: computed(() => !!toValue(userId)),
    staleTime: 5 * 60 * 1000,
  });

  const subscription = computed<SubscriptionStatus>(() => data.value ?? {
    plan: 'free',
    status: 'active',
    is_premium: false,
    trial_end: null,
    current_period_end: null,
    cancel_at_period_end: false,
  });

  const isPremium = computed(() => subscription.value.is_premium);

  async function refreshSubscription() {
    await queryClient.invalidateQueries({ queryKey: queryKey.value });
  }

  return { subscription, isPremium, isLoading, error, refetch, refreshSubscription };
}
