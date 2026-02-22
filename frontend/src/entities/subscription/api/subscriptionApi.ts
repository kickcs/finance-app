import { http } from '@/shared/api/http';
import type { SubscriptionStatus } from '../model/types';

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
    const data = await http.get<SubscriptionStatusResponse>('/subscription/status');
    return transformStatus(data);
  },

  async createCheckout(plan: 'premium_monthly' | 'premium_yearly'): Promise<{ checkout_url: string }> {
    const data = await http.post<{ checkoutUrl: string }>('/subscription/checkout', { plan });
    return { checkout_url: data.checkoutUrl };
  },
};
