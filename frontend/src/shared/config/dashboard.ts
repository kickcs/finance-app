import type { WidgetId } from '@/shared/api/database.types';

/** How far ahead to look for "upcoming" subscriptions on the dashboard. */
export const UPCOMING_SUBSCRIPTION_DAYS = 31;

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  'quick_actions',
  'accounts',
  'top_expenses',
  'transactions',
  'budget',
  'debts',
  'subscriptions',
];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  quick_actions: 'Быстрые действия',
  budget: 'Бюджет',
  accounts: 'Счета',
  top_expenses: 'Топ расходов',
  transactions: 'Последние транзакции',
  debts: 'Долги',
  subscriptions: 'Подписки',
};

/** Widget IDs that are rendered inside the combined DashboardActivityColumn. */
export const ACTIVITY_WIDGET_IDS: ReadonlySet<string> = new Set<WidgetId>([
  'transactions',
  'debts',
  'subscriptions',
]);

/** Widget IDs that the desktop side panel is allowed to render. */
export const SIDE_PANEL_WIDGET_IDS: ReadonlySet<WidgetId> = new Set<WidgetId>([
  'quick_actions',
  'budget',
  'accounts',
  'top_expenses',
  'debts',
  'subscriptions',
]);

export const WIDGET_ICONS: Record<WidgetId, string> = {
  quick_actions: 'bolt',
  budget: 'savings',
  accounts: 'account_balance_wallet',
  top_expenses: 'pie_chart',
  transactions: 'receipt_long',
  debts: 'handshake',
  subscriptions: 'subscriptions',
};
