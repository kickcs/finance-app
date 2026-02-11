import { DomainEvent } from '../../../../shared/domain/base';

export class DebtClosedEvent extends DomainEvent {
  constructor(
    public readonly debtId: string,
    public readonly userId: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'debt.closed';
  }
}
