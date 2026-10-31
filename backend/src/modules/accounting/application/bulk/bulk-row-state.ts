import type { Transaction } from '../../domain/aggregates/transaction';
import { BalanceCalculationService } from '../../domain/services/balance-calculation.service';
import { BalanceLedger, type BalanceDelta } from './balance-ledger';
import type { BulkUndoRow, BulkUndoRowState } from './bulk-undo.token';

/** Поля строки, которые правка вправе менять и которые отмена сверяет и возвращает. */
export function snapshotRow(transaction: Transaction): BulkUndoRowState {
  return {
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    amount: transaction.amountValue,
    currency: transaction.currency,
    description: transaction.description,
    type: transaction.typeValue,
    toAccountId: transaction.toAccountId,
    toAmount: transaction.toAmountValue,
    toCurrency: transaction.toCurrency,
    paymentGroupId: transaction.paymentGroupId,
    isDebtRelated: transaction.isDebtRelated,
  };
}

export function sameRowState(a: BulkUndoRowState, b: BulkUndoRowState): boolean {
  return (Object.keys(a) as (keyof BulkUndoRowState)[]).every((key) => a[key] === b[key]);
}

/** Что нужно сделать с остатками, чтобы строки из состояния `after` вернулись в `before`. */
export function undoBalanceDeltas(rows: BulkUndoRow[]): BalanceDelta[] {
  const ledger = new BalanceLedger();
  for (const row of rows) {
    ledger.addEffects(BalanceCalculationService.balanceEffects(row.before), 1);
    ledger.addEffects(BalanceCalculationService.balanceEffects(row.after), -1);
  }
  return ledger.deltas();
}
