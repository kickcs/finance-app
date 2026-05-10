import { http, HttpError } from '@/shared/api/http';
import type {
  RecurringSubscription,
  RecurringSubscriptionInsert,
  CalendarEntry,
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

interface CalendarEntryResponse {
  subscription: SubscriptionResponse;
  dates: string[];
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

function toInsertPayload(data: RecurringSubscriptionInsert): Record<string, unknown> {
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
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.description !== undefined) payload.description = data.description;
  if (data.amount !== undefined) payload.amount = data.amount;
  if (data.currency !== undefined) payload.currency = data.currency;
  if (data.account_id !== undefined) payload.accountId = data.account_id;
  if (data.icon !== undefined) payload.icon = data.icon;
  if (data.color !== undefined) payload.color = data.color;
  if (data.frequency !== undefined) payload.frequency = data.frequency;
  if (data.frequency_days !== undefined) payload.frequencyDays = data.frequency_days;
  if (data.billing_date !== undefined) payload.billingDate = data.billing_date;
  if (data.notify_days_before !== undefined) payload.notifyDaysBefore = data.notify_days_before;
  if (data.category_id !== undefined) payload.categoryId = data.category_id;
  if (data.auto_charge !== undefined) payload.autoCharge = data.auto_charge;
  return payload;
}

export const recurringSubscriptionApi = {
  async getAll(_userId?: string): Promise<RecurringSubscription[]> {
    const data = await http.get<SubscriptionResponse[]>('/recurring-subscriptions');
    return data.map(transformSubscription);
  },

  async getById(id: string): Promise<RecurringSubscription | null> {
    try {
      const data = await http.get<SubscriptionResponse>(`/recurring-subscriptions/${id}`);
      return transformSubscription(data);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async getUpcoming(_userId?: string, days: number = 7): Promise<RecurringSubscription[]> {
    const data = await http.get<SubscriptionResponse[]>('/recurring-subscriptions/upcoming', {
      params: { days },
    });
    return data.map(transformSubscription);
  },

  async getCalendar(_userId?: string, month?: string): Promise<CalendarEntry[]> {
    const data = await http.get<CalendarEntryResponse[]>('/recurring-subscriptions/calendar', {
      params: month ? { month } : undefined,
    });
    return data.map((entry) => ({
      subscription: transformSubscription(entry.subscription),
      dates: entry.dates,
    }));
  },

  async create(data: RecurringSubscriptionInsert): Promise<RecurringSubscription> {
    const response = await http.post<SubscriptionResponse>(
      '/recurring-subscriptions',
      toInsertPayload(data),
    );
    return transformSubscription(response);
  },

  async update(id: string, data: Partial<RecurringSubscription>): Promise<RecurringSubscription> {
    const response = await http.patch<SubscriptionResponse>(
      `/recurring-subscriptions/${id}`,
      toUpdatePayload(data),
    );
    return transformSubscription(response);
  },

  async pause(id: string): Promise<RecurringSubscription> {
    const response = await http.patch<SubscriptionResponse>(`/recurring-subscriptions/${id}/pause`);
    return transformSubscription(response);
  },

  async resume(id: string): Promise<RecurringSubscription> {
    const response = await http.patch<SubscriptionResponse>(
      `/recurring-subscriptions/${id}/resume`,
    );
    return transformSubscription(response);
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/recurring-subscriptions/${id}`);
  },
};
