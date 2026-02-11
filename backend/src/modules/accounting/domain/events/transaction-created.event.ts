import { DomainEvent } from '../../../../shared/domain/base';

export class TransactionCreatedEvent extends DomainEvent {
  constructor(
    public readonly transactionId: string,
    public readonly userId: string,
    public readonly accountId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly type: 'income' | 'expense' | 'transfer',
    public readonly isDebtRelated: boolean,
    public readonly toAccountId: string | null = null,
    public readonly toAmount: number | null = null,
    public readonly toCurrency: string | null = null,
  ) {
    super();
  }

  get eventName(): string {
    return 'transaction.created';
  }
}
