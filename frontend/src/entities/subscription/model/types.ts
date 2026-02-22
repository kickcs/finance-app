export type SubscriptionPlan = 'free' | 'premium_monthly' | 'premium_yearly';
export type SubscriptionStatusValue = 'active' | 'trialing' | 'canceled' | 'past_due' | 'expired';

export interface SubscriptionStatus {
  plan: SubscriptionPlan;
  status: SubscriptionStatusValue;
  is_premium: boolean;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}
