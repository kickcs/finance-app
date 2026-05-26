import { useQuery, useQueryClient } from '@tanstack/react-query';

import { subscriptionApi } from './subscriptionApi';
import { subscriptionKeys } from './queryKeys';
import type { SubscriptionStatus } from '../model/types';

const FREE_FALLBACK: SubscriptionStatus = {
  plan: 'free',
  status: 'active',
  is_premium: false,
  trial_end: null,
  current_period_end: null,
  cancel_at_period_end: false,
};

export function useSubscription(userId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: subscriptionKeys.status(userId ?? '__disabled__'),
    queryFn: () => subscriptionApi.getStatus(),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const subscription: SubscriptionStatus = query.data ?? FREE_FALLBACK;

  return {
    subscription,
    isPremium: subscription.is_premium,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    refreshSubscription: () => {
      if (!userId) return Promise.resolve();
      return qc.invalidateQueries({ queryKey: subscriptionKeys.status(userId) });
    },
  };
}
