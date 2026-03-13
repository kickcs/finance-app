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

export interface BudgetHistoryItem {
  year: number;
  month: number;
  amount: number;
  currency: string;
  spent: number;
  percentage: number;
}

export interface BudgetHistoryResponse {
  items: BudgetHistoryItem[];
}
