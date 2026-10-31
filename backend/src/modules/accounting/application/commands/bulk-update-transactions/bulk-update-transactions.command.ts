import type { TransactionFilter } from '../../../domain/repositories/transaction.repository.interface';
import type { BalanceDelta, BulkAction, SkippedCount } from './bulk-plan';

export { BULK_ACTION_KINDS, type BulkAction, type BulkActionKind } from './bulk-plan';

/** Предел выборки и ручного выбора: одна транзакция БД должна оставаться короткой. */
export const MAX_BULK_ROWS = 2000;

/** «Изменить все» (фильтр, сверенный с итогом) или ручной выбор. */
export type BulkSelectionInput =
  | { kind: 'filter'; filter: TransactionFilter; asOf: Date; expectedCount: number }
  | { kind: 'ids'; ids: string[] };

export interface BulkUpdateResult {
  /** Строки выборки; с суммой `skipped` равно их числу, невыбранная половина пары не считается. */
  changed: number;
  skipped: SkippedCount[];
  balanceDeltas: BalanceDelta[];
  /** Только у применённой, не удаляющей правки, где что-то изменилось. */
  undoToken?: string;
}

export class BulkUpdateTransactionsCommand {
  constructor(
    public readonly userId: string,
    public readonly selection: BulkSelectionInput,
    public readonly action: BulkAction,
    public readonly dryRun: boolean,
  ) {}
}
