import type { Debt } from '@/shared/api/database.types';
import type { ImportedTransaction } from '@/entities/imported-transaction';
import { groupDebtsByPerson, type DebtByPerson } from '@/entities/debt';
import { pluralize } from '@/shared/lib/format/pluralize';

type RepaymentImport = Pick<ImportedTransaction, 'type' | 'amount' | 'currency'>;

export interface RepaymentGroup extends DebtByPerson {
  /** Валюта импорта — все долги группы отфильтрованы под неё. */
  currency: string;
}

/**
 * Открытые долги, которые можно погасить этим импортом: направление по типу
 * операции (income → «мне вернули» = given; expense → «я вернул» = taken),
 * та же валюта. Поштучный порог остатка не применяется — группировка по
 * человеку (см. eligibleRepaymentGroupsForImport) считает сумму остатков.
 */
function eligibleDebtsForImport(debts: Debt[], item: RepaymentImport): Debt[] {
  if (item.type !== 'income' && item.type !== 'expense') return [];
  const amount = Math.abs(item.amount ?? 0);
  if (amount <= 0) return [];
  const debtType = item.type === 'income' ? 'given' : 'taken';
  return debts.filter(
    (d) => !d.is_closed && d.debt_type === debtType && d.currency === item.currency,
  );
}

/**
 * Долги, сгруппированные по человеку, чей суммарный остаток покрывает сумму
 * импорта: человек с несколькими долгами (например, 300к + 200к) теперь
 * виден при погашении 500к одним платежом.
 */
export function eligibleRepaymentGroupsForImport(
  debts: Debt[],
  item: RepaymentImport,
): RepaymentGroup[] {
  const amount = Math.abs(item.amount ?? 0);
  if (amount <= 0) return [];
  const filtered = eligibleDebtsForImport(debts, item);
  // All debts here are already filtered to item.currency — identity convert.
  return groupDebtsByPerson(filtered, (a) => a)
    .map((g) => ({ ...g, currency: item.currency }))
    .filter((g) => g.totalRemaining >= amount);
}

/**
 * Автоподсказка «похоже, это возврат долга»: ровно одна группа, суммарный
 * остаток которой в точности равен сумме импорта. Принимает уже собранные
 * eligibleRepaymentGroupsForImport-группы, чтобы не группировать дважды.
 */
export function findExactRepaymentMatch(
  groups: RepaymentGroup[],
  item: RepaymentImport,
): RepaymentGroup | null {
  const amount = Math.abs(item.amount ?? 0);
  if (amount <= 0) return null;
  const matches = groups.filter((g) => g.totalRemaining === amount);
  return matches.length === 1 ? matches[0] : null;
}

/** «2 долга», «5 долгов» — подпись количества долгов в группе. */
export function debtsCountLabel(count: number): string {
  return `${count} ${pluralize(count, 'долг', 'долга', 'долгов')}`;
}
