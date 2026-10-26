import type { EntityManager } from 'typeorm';

export interface PaymentSecondPart {
  accountId: string;
  amount: number;
}

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
    public readonly isInformational: boolean = false,
    /** Вторая часть оплаты с другого счёта; `accountId`/`amount` выше — первая. */
    public readonly secondPart?: PaymentSecondPart,
    /** Общий id записей одного расчёта по долгу; ставится записи при создании. */
    public readonly settlementId?: string,
  ) {}
}
