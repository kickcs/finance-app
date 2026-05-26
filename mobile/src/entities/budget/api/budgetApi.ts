import { http } from '@/shared/api/http';

export interface BudgetResponse {
  id: string;
  userId: string;
  year: number | null;
  month: number | null;
  amount: number;
  currency: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetCurrentResponse {
  budget: BudgetResponse;
  spent: number;
  remaining: number;
  percentage: number;
}

export const budgetApi = {
  async getCurrent(): Promise<BudgetCurrentResponse | null> {
    return http<BudgetCurrentResponse | null>('/api/budgets/current');
  },

  async setDefault(amount: number): Promise<{ budget: BudgetResponse }> {
    return http<{ budget: BudgetResponse }>('/api/budgets/default', {
      method: 'PUT',
      body: JSON.stringify({ amount }),
    });
  },

  async setOverride(
    year: number,
    month: number,
    amount: number,
  ): Promise<{ budget: BudgetResponse }> {
    return http<{ budget: BudgetResponse }>('/api/budgets/override', {
      method: 'PUT',
      body: JSON.stringify({ year, month, amount }),
    });
  },

  async removeOverride(year: number, month: number): Promise<void> {
    await http(`/api/budgets/override/${year}/${month}`, { method: 'DELETE' });
  },
};
