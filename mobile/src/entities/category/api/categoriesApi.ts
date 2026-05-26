import { http } from '@/shared/api/http';
import type { Category } from '../model/types';

export type CategoryInput = {
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
};

export const categoriesApi = {
  list: () => http<Category[]>('/api/categories'),
  create: (input: CategoryInput) =>
    http<Category>('/api/categories', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<CategoryInput>) =>
    http<Category>(`/api/categories/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) =>
    http<void>(`/api/categories/${id}`, { method: 'DELETE' }),
  reorder: (type: 'expense' | 'income', orderedIds: string[]) =>
    http<void>('/api/categories/reorder', {
      method: 'POST',
      body: JSON.stringify({ type, orderedIds }),
    }),
};
