import { AggregateRoot } from '../../../../../shared/domain/base';
import { PushDeviceRegisteredEvent } from '../../events/push-device-registered.event';

export type PushDevicePlatform = 'ios' | 'android';

export interface PushDeviceProps {
  id: string;
  userId: string;
  token: string;
  platform: PushDevicePlatform;
  deviceId: string | null;
  createdAt: Date;
}

export class PushDevice extends AggregateRoot<string> {
  private _userId: string;
  private _token: string;
  private _platform: PushDevicePlatform;
  private _deviceId: string | null;
  private _createdAt: Date;

  private constructor(props: PushDeviceProps) {
    super(props.id);
    this._userId = props.userId;
    this._token = props.token;
    this._platform = props.platform;
    this._deviceId = props.deviceId;
    this._createdAt = props.createdAt;
  }

  static register(
    id: string,
    userId: string,
    token: string,
    platform: PushDevicePlatform,
    deviceId?: string | null,
  ): PushDevice {
    const device = new PushDevice({
      id,
      userId,
      token,
      platform,
      deviceId: deviceId ?? null,
      createdAt: new Date(),
    });
    device.addDomainEvent(new PushDeviceRegisteredEvent(id, userId, platform, deviceId ?? null));
    return device;
  }

  static reconstitute(props: PushDeviceProps): PushDevice {
    return new PushDevice(props);
  }

  get userId(): string {
    return this._userId;
  }
  get token(): string {
    return this._token;
  }
  get platform(): PushDevicePlatform {
    return this._platform;
  }
  get deviceId(): string | null {
    return this._deviceId;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
