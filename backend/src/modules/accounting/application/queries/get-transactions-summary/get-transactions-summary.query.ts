import type { TransactionFilter } from '../../../domain/repositories/transaction.repository.interface';

export class GetTransactionsSummaryQuery {
  constructor(
    public readonly userId: string,
    public readonly filter: TransactionFilter,
  ) {}
}
