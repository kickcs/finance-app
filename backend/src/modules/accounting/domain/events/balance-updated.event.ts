import { DomainEvent } from '../../../../shared/domain/base';

export class BalanceUpdatedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
    public readonly currency: string,
    public readonly previousBalance: number,
    public readonly newBalance: number,
    public readonly delta: number,
  ) {
    super();
  }

  get eventName(): string {
    return 'balance.updated';
  }
}
