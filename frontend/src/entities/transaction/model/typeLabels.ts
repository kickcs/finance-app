/** Типы во множественном числе — так их называют вкладки Истории и чипы охвата правки. */
export const TRANSACTION_TYPE_LABELS = {
  expense: 'Расходы',
  income: 'Доходы',
  transfer: 'Переводы',
  debt: 'Долги',
} as const;

export type LabeledTransactionType = keyof typeof TRANSACTION_TYPE_LABELS;

export function transactionTypeLabel(type: string | undefined): string | undefined {
  return type && type in TRANSACTION_TYPE_LABELS
    ? TRANSACTION_TYPE_LABELS[type as LabeledTransactionType]
    : undefined;
}
