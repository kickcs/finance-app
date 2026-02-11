import { DomainEvent } from '../../../../shared/domain/base';

export class DebtCreatedEvent extends DomainEvent {
  constructor(
    public readonly debtId: string,
    public readonly userId: string,
    public readonly debtType: 'given' | 'taken',
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly accountId: string | null,
  ) {
    super();
  }

  get eventName(): string {
    return 'debt.created';
  }
}
