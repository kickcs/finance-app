import { DomainEvent } from '../../../../shared/domain/base';

export class TransactionUpdatedEvent extends DomainEvent {
  constructor(
    public readonly transactionId: string,
    public readonly userId: string,
    public readonly changes: Record<string, unknown>,
    public readonly previousValues: Record<string, unknown>,
  ) {
    super();
  }

  get eventName(): string {
    return 'transaction.updated';
  }
}
