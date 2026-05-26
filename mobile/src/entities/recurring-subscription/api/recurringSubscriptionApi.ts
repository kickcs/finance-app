import { http } from '@/shared/api/http';

import type {
  RecurringSubscription,
  RecurringSubscriptionInsert,
} from '../model/types';

interface SubscriptionResponse {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  accountId: string | null;
  icon: string;
  color: string;
  frequency: string;
  frequencyDays: number | null;
  billingDate: string;
  notifyDaysBefore: number[];
  categoryId: string;
  autoCharge: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function transformSubscription(sub: SubscriptionResponse): RecurringSubscription {
  return {
    id: sub.id,
    user_id: sub.userId,
    name: sub.name,
    description: sub.description,
    amount: sub.amount,
    currency: sub.currency,
    account_id: sub.accountId,
    icon: sub.icon,
    color: sub.color,
    frequency: sub.frequency as RecurringSubscription['frequency'],
    frequency_days: sub.frequencyDays,
    billing_date: sub.billingDate,
    notify_days_before: sub.notifyDaysBefore ?? [2],
    category_id: sub.categoryId,
    auto_charge: sub.autoCharge,
    status: sub.status as RecurringSubscription['status'],
    created_at: sub.createdAt,
    updated_at: sub.updatedAt,
  };
}

function toInsertPayload(data: RecurringSubscriptionInsert) {
  return {
    name: data.name,
    description: data.description,
    amount: data.amount,
    currency: data.currency,
    accountId: data.account_id,
    icon: data.icon,
    color: data.color,
    frequency: data.frequency,
    frequencyDays: data.frequency_days,
    billingDate: data.billing_date,
    notifyDaysBefore: data.notify_days_before,
    categoryId: data.category_id,
    autoCharge: data.auto_charge,
  };
}

function toUpdatePayload(data: Partial<RecurringSubscription>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (data.name !== undefined) p.name = data.name;
  if (data.description !== undefined) p.description = data.description;
  if (data.amount !== undefined) p.amount = data.amount;
  if (data.currency !== undefined) p.currency = data.currency;
  if (data.account_id !== undefined) p.accountId = data.account_id;
  if (data.icon !== undefined) p.icon = data.icon;
  if (data.color !== undefined) p.color = data.color;
  if (data.frequency !== undefined) p.frequency = data.frequency;
  if (data.frequency_days !== undefined) p.frequencyDays = data.frequency_days;
  if (data.billing_date !== undefined) p.billingDate = data.billing_date;
  if (data.notify_days_before !== undefined) p.notifyDaysBefore = data.notify_days_before;
  if (data.category_id !== undefined) p.categoryId = data.category_id;
  if (data.auto_charge !== undefined) p.autoCharge = data.auto_charge;
  return p;
}

export const recurringSubscriptionApi = {
  async getAll(): Promise<RecurringSubscription[]> {
    const data = await http<SubscriptionResponse[]>('/api/recurring-subscriptions');
    return data.map(transformSubscription);
  },

  async getById(id: string): Promise<RecurringSubscription> {
    const data = await http<SubscriptionResponse>(`/api/recurring-subscriptions/${id}`);
    return transformSubscription(data);
  },

  async getUpcoming(days = 7): Promise<RecurringSubscription[]> {
    const data = await http<SubscriptionResponse[]>(
      `/api/recurring-subscriptions/upcoming?days=${days}`,
    );
    return data.map(transformSubscription);
  },

  async create(input: RecurringSubscriptionInsert): Promise<RecurringSubscription> {
    const data = await http<SubscriptionResponse>('/api/recurring-subscriptions', {
      method: 'POST',
      body: JSON.stringify(toInsertPayload(input)),
    });
    return transformSubscription(data);
  },

  async update(
    id: string,
    updates: Partial<RecurringSubscription>,
  ): Promise<RecurringSubscription> {
    const data = await http<SubscriptionResponse>(`/api/recurring-subscriptions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(toUpdatePayload(updates)),
    });
    return transformSubscription(data);
  },

  async delete(id: string): Promise<void> {
    await http(`/api/recurring-subscriptions/${id}`, { method: 'DELETE' });
  },
};
