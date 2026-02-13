export const ACCOUNT_TYPES = ['basic', 'savings', 'credit_card', 'cash', 'loan', 'deposit'] as const

// TODO: re-enable all types after debugging
export const VISIBLE_ACCOUNT_TYPES: AccountType[] = ['basic', 'savings', 'credit_card']
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  basic: 'Основной',
  savings: 'Накопительный',
  credit_card: 'Кредитная карта',
  cash: 'Наличные',
  loan: 'Кредит',
  deposit: 'Вклад',
}

export function getAccountTypeLabel(type: string): string {
  return ACCOUNT_TYPE_LABELS[type as AccountType] ?? type
}
