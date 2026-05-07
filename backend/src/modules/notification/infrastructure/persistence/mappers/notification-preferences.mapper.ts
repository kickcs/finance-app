import { NotificationPreferences } from '../../../domain/aggregates/notification-preferences';
import { NotificationPreferencesOrmEntity } from '../typeorm/notification-preferences.orm-entity';

export class NotificationPreferencesMapper {
  static toDomain(ormEntity: NotificationPreferencesOrmEntity): NotificationPreferences {
    return NotificationPreferences.reconstitute({
      userId: ormEntity.userId,
      subscriptionUpcoming: ormEntity.subscriptionUpcoming,
      subscriptionCharged: ormEntity.subscriptionCharged,
      subscriptionFailed: ormEntity.subscriptionFailed,
      updatedAt: ormEntity.updatedAt,
    });
  }

  static toOrm(prefs: NotificationPreferences): NotificationPreferencesOrmEntity {
    const ormEntity = new NotificationPreferencesOrmEntity();
    ormEntity.userId = prefs.userId;
    ormEntity.subscriptionUpcoming = prefs.subscriptionUpcoming;
    ormEntity.subscriptionCharged = prefs.subscriptionCharged;
    ormEntity.subscriptionFailed = prefs.subscriptionFailed;
    ormEntity.updatedAt = prefs.updatedAt;
    return ormEntity;
  }
}
