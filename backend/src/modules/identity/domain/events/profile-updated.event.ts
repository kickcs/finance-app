import { DomainEvent } from '../../../../shared/domain/base';

export class ProfileUpdatedEvent extends DomainEvent {
  constructor(
    public readonly profileId: string,
    public readonly changes: Record<string, unknown>,
  ) {
    super();
  }

  get eventName(): string {
    return 'profile.updated';
  }
}
