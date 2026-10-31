import type { Transaction } from '@/entities/transaction';
import type { CurrencyTotal } from './formatTotals';

/** Знак строки тот же, что в итоге выборки: перевод и информационная строка денег не двигают. */
function signedAmount(tx: Transaction): number {
  if (tx.is_informational) return 0;
  switch (tx.type) {
    case 'income':
      return tx.amount;
    case 'expense':
      return -tx.amount;
    case 'adjustment':
      return tx.is_debt_related ? -tx.amount : tx.amount;
    default:
      return 0;
  }
}

/** Итог отмеченных строк по валютам, в порядке первого появления валюты. */
export function selectionTotals(rows: readonly Transaction[]): CurrencyTotal[] {
  const totals = new Map<string, number>();
  for (const tx of rows) {
    totals.set(tx.currency, (totals.get(tx.currency) ?? 0) + signedAmount(tx));
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount }));
}
