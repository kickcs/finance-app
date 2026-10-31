import type { TransactionFilter } from '../../../domain/repositories/transaction.repository.interface';

/** Страница ленты: размер (по умолчанию его задаёт `PaginationDto`) и курсор последней строки предыдущей страницы. */
export interface TransactionPage {
  pageSize: number;
  cursorDate?: string;
  cursorCreatedAt?: string;
  cursorId?: string;
}

export class GetTransactionsPaginatedQuery {
  constructor(
    public readonly userId: string,
    public readonly filter: TransactionFilter,
    public readonly page: TransactionPage,
  ) {}
}
