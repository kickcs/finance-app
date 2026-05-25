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
  given: 'var(--color-debt-given)', // matches --color-debt-given in @theme
  taken: 'var(--color-debt-received)', // matches --color-debt-received in @theme
};

// Utilities
export function buildDebtName(direction: DebtDirection, personName: string): string {
  return direction === 'given' ? `Долг от ${personName}` : `Долг для ${personName}`;
}

export function getDebtDisplayName(debt: Debt): string {
  return debt.person_name?.trim() || debt.name.trim();
}

export function getDebtProgress(debt: Debt): number {
  if (debt.total_amount === 0) return 0;
  const paid = debt.total_amount - debt.remaining_amount;
  return Math.min(100, Math.max(0, Math.round((paid / debt.total_amount) * 100)));
}

// --- Paginated debts ---

export interface DebtGroupResponse {
  person_name: string;
  debt_type: 'given' | 'taken';
  debts: Debt[];
}

export interface DebtsPaginatedCursor {
  personName: string;
  debtType: string;
  createdAt: string;
}

export interface DebtsFilters {
  status?: 'active' | 'closed';
  currency?: string;
  personName?: string;
}

export interface PaginatedDebtsResult {
  groups: DebtGroupResponse[];
  totalSummary: {
    totalGiven: Record<string, number>;
    totalTaken: Record<string, number>;
  };
  nextCursor: DebtsPaginatedCursor | null;
  hasMore: boolean;
  totalDebtsCount: number;
}
