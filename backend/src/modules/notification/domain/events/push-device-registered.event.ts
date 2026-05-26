import { DomainEvent } from '../../../../shared/domain/base';

export class PushDeviceRegisteredEvent extends DomainEvent {
  constructor(
    public readonly pushDeviceId: string,
    public readonly userId: string,
    public readonly platform: 'ios' | 'android',
    public readonly deviceId: string | null,
  ) {
    super();
  }

  get eventName(): string {
    return 'push-device.registered';
  }
}
