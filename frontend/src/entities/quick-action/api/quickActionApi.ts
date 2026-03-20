import { http } from '@/shared/api/http';
import type { QuickAction } from '@/shared/api/database.types';

interface QuickActionResponse {
  id: string;
  userId: string;
  categoryId: string;
  accountId: string;
  label: string;
  position: number;
  amount: number | null;
  createdAt: string;
  updatedAt: string;
}

function transformQuickAction(qa: QuickActionResponse): QuickAction {
  return {
    id: qa.id,
    user_id: qa.userId,
    category_id: qa.categoryId,
    account_id: qa.accountId,
    label: qa.label,
    position: qa.position,
    amount: qa.amount,
    created_at: qa.createdAt,
    updated_at: qa.updatedAt,
  };
}

export const quickActionApi = {
  async getAll(): Promise<QuickAction[]> {
    const data = await http.get<QuickActionResponse[]>('/quick-actions');
    return data.map(transformQuickAction);
  },

  async create(params: {
    categoryId: string;
    accountId: string;
    label: string;
    amount?: number | null;
  }): Promise<QuickAction> {
    const data = await http.post<QuickActionResponse>('/quick-actions', params);
    return transformQuickAction(data);
  },

  async update(
    id: string,
    params: { categoryId?: string; accountId?: string; label?: string; amount?: number | null },
  ): Promise<QuickAction> {
    const data = await http.patch<QuickActionResponse>(`/quick-actions/${id}`, params);
    return transformQuickAction(data);
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/quick-actions/${id}`);
  },

  async reorder(ids: string[]): Promise<void> {
    await http.patch('/quick-actions/reorder', { ids });
  },
};
