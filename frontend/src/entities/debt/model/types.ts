import type { Debt } from '@/shared/api/database.types';

// Re-export from database types for consistency
export type { Debt };

// Debt direction type (given = you lent money, taken = you borrowed money)
export type DebtDirection = 'given' | 'taken';

export const DEBT_DIRECTION_LABELS: Record<DebtDirection, string> = {
  given: 'Я дал в долг',
  taken: 'Я взял в долг',
};

export const DEBT_DIRECTION_COLORS: Record<DebtDirection, string> = {
  given: '#f59e0b', // amber
  taken: '#8b5cf6', // purple
};

// Grouping interface for debts by person
export interface DebtsByPerson {
  personName: string;
  debts: Debt[];
  totalRemaining: number;
  totalPaid: number;
  debtType: DebtDirection;
}
