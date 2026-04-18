import { isPastDate } from '@/shared/lib/date';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { type Debt, type DebtDirection, getDebtDisplayName } from '../model/types';

export interface DebtByPerson {
  personName: string;
  debts: Debt[];
  totalRemaining: number;
  debtType: DebtDirection;
  nearestDueDate: string | null;
  hasPrivate: boolean;
}

/**
 * Group active (non-closed) debts by (personName, debtType), summing
 * remaining amounts converted to the user's currency and tracking the
 * nearest upcoming due date per group. Sorted ascending by due date,
 * groups without a due date last.
 */
export function groupDebtsByPerson(
  debts: Debt[],
  convert: (amount: number, fromCurrency: string) => number,
): DebtByPerson[] {
  const grouped = new Map<string, DebtByPerson>();

  for (const debt of debts) {
    if (debt.is_closed) continue;
    const personName = getDebtDisplayName(debt);
    const key = `${personName}_${debt.debt_type}`;
    let group = grouped.get(key);
    if (!group) {
      group = {
        personName,
        debts: [],
        totalRemaining: 0,
        debtType: debt.debt_type,
        nearestDueDate: null,
        hasPrivate: false,
      };
      grouped.set(key, group);
    }
    group.debts.push(debt);
    if (debt.is_private) group.hasPrivate = true;
    group.totalRemaining += convert(debt.remaining_amount, debt.currency || DEFAULT_CURRENCY);
    if (
      debt.next_payment_date &&
      (!group.nearestDueDate || debt.next_payment_date < group.nearestDueDate)
    ) {
      group.nearestDueDate = debt.next_payment_date;
    }
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.nearestDueDate && b.nearestDueDate) {
      return a.nearestDueDate.localeCompare(b.nearestDueDate);
    }
    if (a.nearestDueDate) return -1;
    if (b.nearestDueDate) return 1;
    return 0;
  });
}

export function countOverdueDebts(debts: Debt[]): number {
  return debts.filter((d) => !d.is_closed && d.next_payment_date && isPastDate(d.next_payment_date))
    .length;
}

/**
 * Split debt groups into `given` / `taken` buckets in one pass.
 * Callers pick the active tab without re-filtering on every keystroke.
 */
export function bucketDebtsByType(groups: DebtByPerson[]): Record<DebtDirection, DebtByPerson[]> {
  const given: DebtByPerson[] = [];
  const taken: DebtByPerson[] = [];
  for (const group of groups) {
    (group.debtType === 'given' ? given : taken).push(group);
  }
  return { given, taken };
}
