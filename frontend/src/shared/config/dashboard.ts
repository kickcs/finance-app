import type { WidgetId } from '@/shared/api/database.types';

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  'quick_actions',
  'accounts',
  'top_expenses',
  'transactions',
  'debts',
  'reminders',
];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  quick_actions: 'Быстрые действия',
  accounts: 'Счета',
  top_expenses: 'Топ расходов',
  transactions: 'Последние транзакции',
  debts: 'Долги',
  reminders: 'Напоминания',
};

export const WIDGET_ICONS: Record<WidgetId, string> = {
  quick_actions: 'bolt',
  accounts: 'account_balance_wallet',
  top_expenses: 'pie_chart',
  transactions: 'receipt_long',
  debts: 'handshake',
  reminders: 'notifications',
};
