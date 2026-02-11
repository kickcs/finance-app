import { DomainEvent } from '../../../../shared/domain/base';

export class AccountCreatedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly type: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'account.created';
  }
}
