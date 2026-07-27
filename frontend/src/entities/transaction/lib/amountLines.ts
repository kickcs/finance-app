import type { Transaction } from '../model/types';

export interface AmountLinesOptions {
  /** Счёт, из карточки которого смотрим: перевод тогда рисуется односторонним */
  viewingAccountId?: string;
  /** Остаток по счёту после операции, если он вообще считается */
  balanceAfter?: number;
}

export interface AmountLines {
  /** Сумма в валюте счёта-получателя */
  conversion: boolean;
  /** Зачёркнутая исходная сумма расхода, часть которого вернули */
  originalAmount: boolean;
  /** Остаток по счёту после операции */
  balanceAfter: boolean;
  /** Сколько строк рисуется помимо самой суммы */
  count: number;
}

/**
 * Какие строки колонка суммы рисует помимо самой суммы.
 *
 * Единственный источник и для разметки `TransactionItem`, и для расчёта высоты
 * строки в виртуализированном списке: список резервирует слот заранее и
 * обрезает содержимое, если разошлись — поэтому условия должны жить в одном
 * месте, а не зеркалиться руками в двух файлах.
 */
export function getAmountLines(tx: Transaction, options: AmountLinesOptions = {}): AmountLines {
  const conversion =
    tx.type === 'transfer' &&
    !options.viewingAccountId &&
    !!tx.to_currency &&
    tx.to_currency !== tx.currency;

  const originalAmount = !tx.is_informational && !!tx.has_debt_returns && tx.type === 'expense';

  const balanceAfter = options.balanceAfter !== undefined;

  return {
    conversion,
    originalAmount,
    balanceAfter,
    count: Number(conversion) + Number(originalAmount) + Number(balanceAfter),
  };
}
