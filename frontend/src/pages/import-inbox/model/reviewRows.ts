import type { TransactionFormData } from '@/features/add-transaction';

export interface ReviewRowsVisibility {
  /** Строка «Счёт» (расход/доход; у перевода счета внутри TransferPanel). */
  account: boolean;
  /** Строка «Категория» (у перевода категория фиксированная). */
  category: boolean;
  /** Вместо HeroAmount и строк счёта/категории — TransferPanel целиком. */
  transferPanel: boolean;
  /** Чип «Разделить» — только для расхода. */
  split: boolean;
}

/** Какие строки чеклиста показывать для данного типа операции. */
export function reviewRows(type: TransactionFormData['type']): ReviewRowsVisibility {
  const transfer = type === 'transfer';
  return {
    account: !transfer,
    category: !transfer,
    transferPanel: transfer,
    split: type === 'expense',
  };
}
