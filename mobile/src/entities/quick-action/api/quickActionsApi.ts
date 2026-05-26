import { http } from '@/shared/api/http';
import type { QuickAction } from '../model/types';

export type QuickActionInput = {
  category_id: string;
  account_id: string;
  label: string;
  position?: number;
  amount?: number | null;
};

export const quickActionsApi = {
  list: () => http<QuickAction[]>('/api/quick-actions'),
  create: (input: QuickActionInput) =>
    http<QuickAction>('/api/quick-actions', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<QuickActionInput>) =>
    http<QuickAction>(`/api/quick-actions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    http<void>(`/api/quick-actions/${id}`, { method: 'DELETE' }),
  reorder: (orderedIds: string[]) =>
    http<void>('/api/quick-actions/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ orderedIds }),
    }),
};
