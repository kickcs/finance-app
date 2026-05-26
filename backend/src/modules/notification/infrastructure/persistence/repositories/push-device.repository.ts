import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushDevice } from '../../../domain/aggregates/push-device';
import { IPushDeviceRepository } from '../../../domain/repositories';
import { PushDeviceOrmEntity } from '../typeorm/push-device.orm-entity';
import { PushDeviceMapper } from '../mappers/push-device.mapper';

@Injectable()
export class PushDeviceRepository implements IPushDeviceRepository {
  constructor(
    @InjectRepository(PushDeviceOrmEntity)
    private readonly ormRepository: Repository<PushDeviceOrmEntity>,
  ) {}

  async upsertByUserAndToken(device: PushDevice): Promise<void> {
    // `repository.upsert(ormEntity)` would include the freshly-generated
    // `id` and `createdAt` from the aggregate in the ON CONFLICT DO UPDATE
    // SET clause, rewriting the existing row's primary key on every
    // re-registration (breaking any FK or external reference) and resetting
    // the first-registration timestamp. Restrict the update to fields that
    // legitimately change on re-registration: platform / deviceId / updatedAt.
    await this.ormRepository
      .createQueryBuilder()
      .insert()
      .into(PushDeviceOrmEntity)
      .values({
        id: device.id,
        userId: device.userId,
        token: device.token,
        platform: device.platform,
        deviceId: device.deviceId,
        createdAt: device.createdAt,
      })
      .orUpdate(['platform', 'device_id', 'updated_at'], ['user_id', 'token'], {
        skipUpdateIfNoValuesChanged: true,
      })
      .execute();
  }

  async findByUserId(userId: string): Promise<PushDevice[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return ormEntities.map((entity) => PushDeviceMapper.toDomain(entity));
  }

  async removeByToken(userId: string, token: string): Promise<void> {
    await this.ormRepository.delete({ userId, token });
  }
}
