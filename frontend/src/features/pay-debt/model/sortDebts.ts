import type { Debt } from '@/shared/api/database.types';

/** Sort debts by created_at ascending (oldest first) for FIFO distribution. */
export function sortDebtsByDateAsc(debts: Debt[]): Debt[] {
  return [...debts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}
