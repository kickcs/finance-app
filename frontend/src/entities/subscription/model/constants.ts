import type { SubscriptionPlan } from './types';

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: 'Бесплатный',
  premium_monthly: 'Premium (месяц)',
  premium_yearly: 'Premium (год)',
};

export const PLAN_PRICES: Record<'premium_monthly' | 'premium_yearly', string> = {
  premium_monthly: '$2.99/мес',
  premium_yearly: '$16.99/год',
};

export const PREMIUM_FEATURES = [
  {
    icon: 'trending_up',
    label: 'Расширенная аналитика',
    description: 'Тренды, сравнение месяцев, прогнозы',
  },
  { icon: 'download', label: 'Экспорт данных', description: 'PDF и Excel отчёты' },
  {
    icon: 'repeat',
    label: 'Рекуррентные транзакции',
    description: 'Автоматическое создание повторяющихся транзакций',
  },
  {
    icon: 'account_balance_wallet',
    label: 'Бюджеты по категориям',
    description: 'Лимиты с уведомлениями',
  },
  {
    icon: 'palette',
    label: 'Темы оформления',
    description: 'Дополнительные варианты внешнего вида',
  },
  { icon: 'new_releases', label: 'Ранний доступ', description: 'Новые функции раньше всех' },
  {
    icon: 'document_scanner',
    label: 'Сканирование чеков',
    description: 'Сфотографируйте чек и разделите расходы по позициям',
  },
];
