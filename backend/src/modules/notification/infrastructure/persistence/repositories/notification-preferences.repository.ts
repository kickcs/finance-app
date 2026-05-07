import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreferences } from '../../../domain/aggregates/notification-preferences';
import { INotificationPreferencesRepository } from '../../../domain/repositories';
import { NotificationPreferencesOrmEntity } from '../typeorm/notification-preferences.orm-entity';
import { NotificationPreferencesMapper } from '../mappers/notification-preferences.mapper';

@Injectable()
export class NotificationPreferencesRepository implements INotificationPreferencesRepository {
  constructor(
    @InjectRepository(NotificationPreferencesOrmEntity)
    private readonly ormRepository: Repository<NotificationPreferencesOrmEntity>,
  ) {}

  async findByUserId(userId: string): Promise<NotificationPreferences | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { userId } });
    if (!ormEntity) return null;
    return NotificationPreferencesMapper.toDomain(ormEntity);
  }

  async save(prefs: NotificationPreferences): Promise<NotificationPreferences> {
    const ormEntity = NotificationPreferencesMapper.toOrm(prefs);
    await this.ormRepository.upsert(ormEntity, ['userId']);
    const saved = await this.ormRepository.findOneOrFail({ where: { userId: prefs.userId } });
    return NotificationPreferencesMapper.toDomain(saved);
  }
}
