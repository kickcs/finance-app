export type HintId = 'split-expense' | 'scan-receipt' | 'dashboard-settings';

export type CounterKey = 'expenses_count' | 'transactions_count' | 'dashboard_visits';

export interface HintConfig {
  id: HintId;
  title: string;
  description: string;
  actionLabel: string;
  actionRoute?: string;
  triggerCounter: CounterKey;
  triggerThreshold: number;
}
