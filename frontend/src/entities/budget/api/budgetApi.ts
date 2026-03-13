import { http } from '@/shared/api/http';
import type { BudgetCurrentResponse, BudgetHistoryResponse, BudgetResponse } from '../model/types';

export const budgetApi = {
  async getCurrent(): Promise<BudgetCurrentResponse | null> {
    return http.get<BudgetCurrentResponse | null>('/budgets/current');
  },

  async getHistory(months = 6): Promise<BudgetHistoryResponse> {
    return http.get<BudgetHistoryResponse>(`/budgets/history?months=${months}`);
  },

  async setDefault(amount: number): Promise<{ budget: BudgetResponse }> {
    return http.put<{ budget: BudgetResponse }>('/budgets/default', { amount });
  },

  async setOverride(
    year: number,
    month: number,
    amount: number,
  ): Promise<{ budget: BudgetResponse }> {
    return http.put<{ budget: BudgetResponse }>('/budgets/override', { year, month, amount });
  },

  async removeOverride(year: number, month: number): Promise<void> {
    await http.delete(`/budgets/override/${year}/${month}`);
  },
};
