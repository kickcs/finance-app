import type { Debt } from '@/shared/api/database.types';

/** «Закрыть все» и зачёт — один расчёт на несколько долгов, и отмена снимает его целиком. */
export const SHARED_SETTLEMENT_NOTE =
  'Если долг закрывали вместе с другими — через «Закрыть все» или зачёт, — вернутся и они.';

/** Был ли по долгу хоть какой-то расчёт — судим по самому долгу, записи для этого не нужны. */
export function debtHasSettlements(debt: Debt): boolean {
  return debt.is_closed || debt.remaining_amount < debt.total_amount || debt.forgiven_amount > 0;
}
