import { DomainEvent } from '../../../../shared/domain/base';

export class ProfileCreatedEvent extends DomainEvent {
  constructor(
    public readonly profileId: string,
    public readonly email: string | null,
    public readonly isDemo: boolean,
  ) {
    super();
  }

  get eventName(): string {
    return 'profile.created';
  }
}
