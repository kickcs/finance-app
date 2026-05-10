import type { EntityManager } from 'typeorm';

export class CreateTransactionCommand {
  constructor(
    public readonly userId: string,
    public readonly accountId: string,
    public readonly categoryId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly type: 'income' | 'expense' | 'transfer',
    public readonly date: Date,
    public readonly description?: string,
    public readonly isDebtRelated: boolean = false,
    public readonly toAccountId?: string,
    public readonly toAmount?: number,
    public readonly toCurrency?: string,
    public readonly debtId?: string,
    public readonly feeAmount?: number,
    /**
     * Optional outer EntityManager. When provided, the handler reuses this
     * manager instead of opening its own `dataSource.transaction(...)`. Lets
     * callers (e.g. recurring auto-charge) compose this command into an
     * outer transaction so failures roll back atomically.
     */
    public readonly manager?: EntityManager,
  ) {}
}
