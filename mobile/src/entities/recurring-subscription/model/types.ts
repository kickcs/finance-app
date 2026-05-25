export type SubscriptionFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type SubscriptionStatus = 'active' | 'paused';

export interface RecurringSubscription {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  account_id: string | null;
  icon: string;
  color: string;
  frequency: SubscriptionFrequency;
  frequency_days: number | null;
  billing_date: string;
  notify_days_before: number[];
  category_id: string;
  auto_charge: boolean;
  status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
}

export interface RecurringSubscriptionInsert {
  name: string;
  description?: string;
  amount: number;
  currency: string;
  account_id?: string;
  icon: string;
  color: string;
  frequency: SubscriptionFrequency;
  frequency_days?: number;
  billing_date: string;
  notify_days_before?: number[];
  category_id?: string;
  auto_charge?: boolean;
}

export interface CalendarEntry {
  subscription: RecurringSubscription;
  dates: string[];
}
