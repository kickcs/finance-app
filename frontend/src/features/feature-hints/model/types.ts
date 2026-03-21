export type HintId = 'split-expense' | 'dashboard-settings';

export type DotId = 'add-button' | 'dashboard-settings';

export type CounterKey = 'expenses_count' | 'dashboard_visits';

export interface HintConfig {
  id: HintId;
  title: string;
  description: string;
  actionLabel: string;
  actionRoute?: string;
  triggerCounter: CounterKey;
  triggerThreshold: number;
}
