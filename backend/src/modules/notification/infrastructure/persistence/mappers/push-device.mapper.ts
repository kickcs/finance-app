import { PushDevice } from '../../../domain/aggregates/push-device';
import { PushDeviceOrmEntity } from '../typeorm/push-device.orm-entity';

export class PushDeviceMapper {
  static toDomain(ormEntity: PushDeviceOrmEntity): PushDevice {
    return PushDevice.reconstitute({
      id: ormEntity.id,
      userId: ormEntity.userId,
      token: ormEntity.token,
      platform: ormEntity.platform,
      deviceId: ormEntity.deviceId,
      createdAt: ormEntity.createdAt,
    });
  }

  static toOrm(device: PushDevice): PushDeviceOrmEntity {
    const ormEntity = new PushDeviceOrmEntity();
    ormEntity.id = device.id;
    ormEntity.userId = device.userId;
    ormEntity.token = device.token;
    ormEntity.platform = device.platform;
    ormEntity.deviceId = device.deviceId;
    ormEntity.createdAt = device.createdAt;
    return ormEntity;
  }
}
