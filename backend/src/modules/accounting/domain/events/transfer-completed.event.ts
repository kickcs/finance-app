import { DomainEvent } from '../../../../shared/domain/base';

export class TransferCompletedEvent extends DomainEvent {
  constructor(
    public readonly transactionId: string,
    public readonly userId: string,
    public readonly fromAccountId: string,
    public readonly toAccountId: string,
    public readonly fromAmount: number,
    public readonly toAmount: number,
    public readonly fromCurrency: string,
    public readonly toCurrency: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'transfer.completed';
  }
}
