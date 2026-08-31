import { isPastDate } from '@/shared/lib/date';
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

/** Скрытый долг прячет имя человека везде, где долг показан. */
export function maskDebtName(debt: Debt): string {
  return debt.is_private ? '•••' : getDebtDisplayName(debt);
}

/** Закрытый долг не просрочен, даже если срок давно прошёл. */
export function isDebtOverdue(debt: Debt): boolean {
  return !debt.is_closed && !!debt.next_payment_date && isPastDate(debt.next_payment_date);
}

const MS_IN_DAY = 24 * 60 * 60 * 1000;

/**
 * Дни просрочки, минимум один: `isPastDate` считает просрочкой любую дату
 * строго раньше сегодняшней, и без пола вчерашний срок давал бы «0 дней».
 */
export function getDebtOverdueDays(debt: Debt): number | null {
  if (!isDebtOverdue(debt)) return null;
  const due = new Date(debt.next_payment_date!).getTime();
  return Math.max(1, Math.floor((Date.now() - due) / MS_IN_DAY));
}

/**
 * Долг разложен на три непересекающиеся части: отдано, прощено, осталось.
 *
 * Прощение обнуляет остаток наравне с оплатой, поэтому «сумма − остаток» — это
 * отданное И прощённое разом; прощённое приходится вычитать явно, иначе части
 * в сумме дают больше самого долга.
 */
export function getDebtSplit(debt: Debt): { paid: number; forgiven: number; remaining: number } {
  const forgiven = debt.forgiven_amount ?? 0;
  return {
    paid: Math.max(0, debt.total_amount - debt.remaining_amount - forgiven),
    forgiven,
    remaining: debt.remaining_amount,
  };
}

export function getDebtProgress(debt: Debt): number {
  if (debt.total_amount === 0) return 0;
  const paid = debt.total_amount - debt.remaining_amount;
  return Math.min(100, Math.max(0, Math.round((paid / debt.total_amount) * 100)));
}

/**
 * Что у долга можно править напрямую. Остатка, закрытия и прощённого здесь
 * нет: их считает сервер по платежу, и клиенту эти поля писать нечем.
 */
export type DebtUpdate = Partial<
  Pick<
    Debt,
    | 'name'
    | 'total_amount'
    | 'monthly_payment'
    | 'next_payment_date'
    | 'debt_type'
    | 'person_name'
    | 'account_id'
    | 'transaction_id'
    | 'source_transaction_id'
    | 'description'
    | 'is_private'
    | 'created_at'
    | 'fee_amount'
  >
>;

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

export type DebtStatus = 'active' | 'closed';

export interface DebtsFilters {
  status?: DebtStatus;
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
