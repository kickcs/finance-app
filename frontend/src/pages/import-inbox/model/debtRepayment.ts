import type { Debt } from '@/shared/api/database.types';
import type { ImportedTransaction } from '@/entities/imported-transaction';

type RepaymentImport = Pick<ImportedTransaction, 'type' | 'amount' | 'currency'>;

/**
 * Долги, которые можно погасить этим импортом: направление по типу операции
 * (income → «мне вернули» = given; expense → «я вернул» = taken), та же валюта,
 * остаток не меньше суммы (переплата в v1 не поддерживается — makePartialPayment
 * потребовал бы категорию для excess).
 */
export function eligibleDebtsForImport(debts: Debt[], item: RepaymentImport): Debt[] {
  if (item.type !== 'income' && item.type !== 'expense') return [];
  const amount = Math.abs(item.amount ?? 0);
  if (amount <= 0) return [];
  const debtType = item.type === 'income' ? 'given' : 'taken';
  return debts.filter(
    (d) =>
      !d.is_closed &&
      d.debt_type === debtType &&
      d.currency === item.currency &&
      d.remaining_amount >= amount,
  );
}

/**
 * Автоподсказка «похоже, это возврат долга»: ровно один подходящий долг,
 * остаток которого в точности равен сумме импорта.
 */
export function findExactRepaymentMatch(debts: Debt[], item: RepaymentImport): Debt | null {
  const amount = Math.abs(item.amount ?? 0);
  if (amount <= 0) return null;
  const matches = eligibleDebtsForImport(debts, item).filter((d) => d.remaining_amount === amount);
  return matches.length === 1 ? matches[0] : null;
}
