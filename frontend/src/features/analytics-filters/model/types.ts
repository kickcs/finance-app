export type PeriodScale = 'day' | 'month' | 'year';

export interface AccountFilters {
  selectedAccountIds: string[];
}

export interface CategoryStat {
  id: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  percent: number;
}
