import type { Debt } from '@/shared/api/database.types';
import type { ImportedTransaction } from '@/entities/imported-transaction';
import { groupDebtsByPerson, type DebtByPerson } from '@/entities/debt';
import { pluralize } from '@/shared/lib/format/pluralize';
import { CURRENCIES, formatCurrency } from '@/shared/lib/format/currency';

type RepaymentImport = Pick<ImportedTransaction, 'type' | 'amount' | 'currency'>;

export interface RepaymentGroup extends DebtByPerson {
  /** Валюта импорта — все долги группы отфильтрованы под неё. */
  currency: string;
  /** Платёж минус остаток: >0 — переплата, <0 — платёж покрывает не всё, 0 — ровно. */
  difference: number;
  /** Расхождение укладывается в допуск округления — считаем это тем же долгом. */
  isNearMatch: boolean;
}

/** Доля суммы, которая ещё сходит за округление при сверке с остатком долга. */
const TOLERANCE_RATE = 0.02;

/** Деньги хранятся с двумя знаками — сравниваем их так же, иначе копейка ломает равенство. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * «Мелочь» валюты: у сума нет копеек и суммы на три порядка крупнее, поэтому
 * его шум округления — тысяча, а у доллара с копейками — единица.
 */
function roundingNoise(currency: string): number {
  return (CURRENCIES[currency]?.decimals ?? 2) === 0 ? 1000 : 1;
}

/**
 * Допуск при сверке платежа с остатком долга. Долг в 239 000 возвращают
 * переводом на 240 000 — округляют вверх, и точное равенство такой возврат не
 * ловило: человек просто пропадал из списка погашения. Пол и потолок считаем
 * от «мелочи» валюты, чтобы 2% на крупных суммах не выросли в десятки тысяч.
 */
export function repaymentTolerance(amount: number, currency: string): number {
  const noise = roundingNoise(currency);
  return Math.min(Math.max(amount * TOLERANCE_RATE, noise), noise * 10);
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
 * импорта: человек с несколькими долгами (например, 300к + 200к) виден при
 * погашении 500к одним платежом. Остаток чуть меньше платежа — тоже группа:
 * переплата в пределах допуска (см. repaymentTolerance) это то же погашение,
 * а не чужой перевод. Близкие совпадения идут первыми.
 */
export function eligibleRepaymentGroupsForImport(
  debts: Debt[],
  item: RepaymentImport,
): RepaymentGroup[] {
  const amount = Math.abs(item.amount ?? 0);
  if (amount <= 0) return [];
  const filtered = eligibleDebtsForImport(debts, item);
  const tolerance = repaymentTolerance(amount, item.currency);
  // All debts here are already filtered to item.currency — identity convert.
  return groupDebtsByPerson(filtered, (a) => a)
    .map((g) => {
      const difference = round2(amount - g.totalRemaining);
      return {
        ...g,
        currency: item.currency,
        difference,
        isNearMatch: Math.abs(difference) <= tolerance,
      };
    })
    .filter((g) => g.difference <= 0 || g.isNearMatch)
    .sort((a, b) => nearMatchRank(a) - nearMatchRank(b));
}

/** Близкие совпадения вперёд, среди них — с меньшим расхождением. */
function nearMatchRank(group: RepaymentGroup): number {
  return group.isNearMatch ? Math.abs(group.difference) : Number.MAX_SAFE_INTEGER;
}

/**
 * Автоподсказка «похоже, это возврат долга»: ровно одна группа, чей суммарный
 * остаток сходится с суммой импорта в пределах допуска округления. Если таких
 * несколько — спасает точное совпадение, но только когда оно единственное.
 * Принимает уже собранные eligibleRepaymentGroupsForImport-группы, чтобы не
 * группировать дважды.
 */
export function findRepaymentMatch(
  groups: RepaymentGroup[],
  item: RepaymentImport,
): RepaymentGroup | null {
  const amount = Math.abs(item.amount ?? 0);
  if (amount <= 0) return null;
  const near = groups.filter((g) => g.isNearMatch);
  if (near.length === 1) return near[0];
  const exact = near.filter((g) => g.difference === 0);
  return exact.length === 1 ? exact[0] : null;
}

/**
 * Что станет с расхождением, если погасить группу этим платежом. Null — когда
 * платёж сходится ровно или заведомо меньше долга (обычное частичное
 * погашение, остаток и так виден в строке).
 */
export function repaymentDifferenceLabel(group: RepaymentGroup): string | null {
  if (!group.isNearMatch || group.difference === 0) return null;
  return group.difference > 0
    ? `Переплата ${formatCurrency(group.difference, group.currency)} — отдельной записью`
    : `Остаток ${formatCurrency(-group.difference, group.currency)} спишется`;
}

/** «2 долга», «5 долгов» — подпись количества долгов в группе. */
export function debtsCountLabel(count: number): string {
  return `${count} ${pluralize(count, 'долг', 'долга', 'долгов')}`;
}
