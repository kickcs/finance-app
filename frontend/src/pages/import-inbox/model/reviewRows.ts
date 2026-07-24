import type { TransactionFormData } from '@/features/add-transaction';

export interface ReviewRowsVisibility {
  /** Строка «Счёт» (расход/доход; у перевода счета внутри TransferPanel). */
  account: boolean;
  /** Строка «Категория» (у перевода категория фиксированная; при пометке долгом категория тоже фиксированная). */
  category: boolean;
  /** Вместо HeroAmount и строк счёта/категории — TransferPanel целиком. */
  transferPanel: boolean;
  /** Чип «Разделить» — только для расхода и только если операция не помечена как долг. */
  split: boolean;
}

/**
 * Какие строки чеклиста показывать для данного типа операции.
 * @param debtAssigned Операция помечена как «долг на человека» — категория
 * тогда фиксированная (debt_given/debt_taken), а разделение расхода
 * недоступно (сумма целиком уходит в долг).
 */
export function reviewRows(
  type: TransactionFormData['type'],
  debtAssigned = false,
): ReviewRowsVisibility {
  const transfer = type === 'transfer';
  return {
    account: !transfer,
    category: !transfer && !debtAssigned,
    transferPanel: transfer,
    split: type === 'expense' && !debtAssigned,
  };
}
