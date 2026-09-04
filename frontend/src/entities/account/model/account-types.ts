export const ACCOUNT_TYPES = [
  'basic',
  'savings',
  'credit_card',
  'cash',
  'loan',
  'deposit',
] as const;

export const VISIBLE_ACCOUNT_TYPES: AccountType[] = ['basic', 'savings', 'cash', 'credit_card'];
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  basic: 'Основной',
  savings: 'Накопительный',
  credit_card: 'Кредитная карта',
  cash: 'Наличные',
  loan: 'Кредит',
  deposit: 'Вклад',
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  basic: 'account_balance_wallet',
  savings: 'savings',
  credit_card: 'credit_card',
  cash: 'payments',
  loan: 'account_balance',
  deposit: 'diamond',
};

export function getAccountTypeLabel(type: string): string {
  return ACCOUNT_TYPE_LABELS[type as AccountType] ?? type;
}
