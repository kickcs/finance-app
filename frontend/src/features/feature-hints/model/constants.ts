import type { HintConfig } from './types';

export const HINT_CONFIGS: Record<string, HintConfig> = {
  'split-expense': {
    id: 'split-expense',
    title: 'Совет: Разделите расход',
    description: 'Нажмите «Разделить», чтобы поделить сумму с друзьями',
    actionLabel: 'Попробовать →',
    triggerCounter: 'expenses_count',
    triggerThreshold: 3,
  },
  'scan-receipt': {
    id: 'scan-receipt',
    title: 'Совет: Сканируйте чеки',
    description: 'Сфотографируйте чек — мы заполним транзакцию за вас',
    actionLabel: 'Попробовать →',
    actionRoute: '/scan-receipt',
    triggerCounter: 'transactions_count',
    triggerThreshold: 5,
  },
  'dashboard-settings': {
    id: 'dashboard-settings',
    title: 'Совет: Настройте дашборд',
    description: 'Вы можете менять порядок и видимость виджетов',
    actionLabel: 'Попробовать →',
    actionRoute: '/dashboard-settings',
    triggerCounter: 'dashboard_visits',
    triggerThreshold: 7,
  },
};

export const STORAGE_KEYS = {
  HINTS_DISMISSED: 'finance_app_hints_dismissed',
  HINTS_COUNTERS: 'finance_app_hints_counters',
  DISCOVERY_DOTS: 'finance_app_discovery_dots',
} as const;
