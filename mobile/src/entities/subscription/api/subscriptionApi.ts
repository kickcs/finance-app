import { http } from '@/shared/api/http';

import type { SubscriptionPlan, SubscriptionStatus } from '../model/types';

interface SubscriptionStatusResponse {
  plan: string;
  status: string;
  isPremium: boolean;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

function transformStatus(s: SubscriptionStatusResponse): SubscriptionStatus {
  return {
    plan: s.plan as SubscriptionStatus['plan'],
    status: s.status as SubscriptionStatus['status'],
    is_premium: s.isPremium,
    trial_end: s.trialEnd,
    current_period_end: s.currentPeriodEnd,
    cancel_at_period_end: s.cancelAtPeriodEnd,
  };
}

export const subscriptionApi = {
  async getStatus(): Promise<SubscriptionStatus> {
    const data = await http<SubscriptionStatusResponse>('/api/subscription/status');
    return transformStatus(data);
  },

  async createCheckout(
    plan: Exclude<SubscriptionPlan, 'free'>,
  ): Promise<{ checkout_url: string }> {
    const data = await http<{ checkoutUrl: string }>('/api/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
    return { checkout_url: data.checkoutUrl };
  },
};
