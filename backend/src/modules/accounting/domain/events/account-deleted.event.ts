import { DomainEvent } from '../../../../shared/domain/base';

export class AccountDeletedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'account.deleted';
  }
}
