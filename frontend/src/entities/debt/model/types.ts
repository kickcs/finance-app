import type { Debt } from '@/shared/api/database.types';

// Re-export from database types for consistency
export type { Debt };

// Debt direction type (given = you lent money, taken = you borrowed money)
export type DebtDirection = 'given' | 'taken';

export const DEBT_DIRECTION_LABELS: Record<DebtDirection, string> = {
  given: 'Я дал в долг',
  taken: 'Я взял в долг',
};

export const DEBT_DIRECTION_DISPLAY: Record<DebtDirection, string> = {
  given: 'Вам должны',
  taken: 'Вы должны',
};

export const DEBT_DIRECTION_COLORS: Record<DebtDirection, string> = {
  given: '#f59e0b', // amber
  taken: '#a855f7', // purple
};

// Utilities
export function getDebtDisplayName(debt: Debt): string {
  return debt.person_name || debt.name;
}

export function getDebtProgress(debt: Debt): number {
  if (debt.total_amount === 0) return 0;
  const paid = debt.total_amount - debt.remaining_amount;
  return Math.min(100, Math.max(0, Math.round((paid / debt.total_amount) * 100)));
}

// Grouping interface for debts by person
export interface DebtsByPerson {
  personName: string;
  debts: Debt[];
  totalRemaining: number;
  totalPaid: number;
  debtType: DebtDirection;
}
