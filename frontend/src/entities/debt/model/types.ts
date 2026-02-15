import type { Debt } from '@/shared/api/database.types';

// Re-export from database types for consistency
export type { Debt };
export type DebtId = string;

// Debt direction type (given = you lent money, taken = you borrowed money)
export type DebtDirection = 'given' | 'taken';

export const DEBT_DIRECTION_LABELS: Record<DebtDirection, string> = {
  given: 'Я дал в долг',
  taken: 'Я взял в долг',
};

export const DEBT_DIRECTION_ICONS: Record<DebtDirection, string> = {
  given: 'arrow_upward',
  taken: 'arrow_downward',
};

export const DEBT_DIRECTION_COLORS: Record<DebtDirection, string> = {
  given: '#f59e0b', // amber
  taken: '#8b5cf6', // purple
};

// Legacy debt types for backward compatibility
export const DEBT_TYPES = [
  { id: 'mortgage', name: 'Ипотека', icon: 'home' },
  { id: 'car_loan', name: 'Автокредит', icon: 'directions_car' },
  { id: 'consumer', name: 'Потребительский', icon: 'credit_card' },
  { id: 'credit_card', name: 'Кредитная карта', icon: 'credit_score' },
  { id: 'personal', name: 'Личный долг', icon: 'person' },
  { id: 'other', name: 'Другое', icon: 'payments' },
] as const;

export type DebtType = (typeof DEBT_TYPES)[number]['id'];

// Grouping interface for debts by person
export interface DebtsByPerson {
  personName: string;
  debts: Debt[];
  totalRemaining: number;
  totalPaid: number;
  debtType: DebtDirection;
}
