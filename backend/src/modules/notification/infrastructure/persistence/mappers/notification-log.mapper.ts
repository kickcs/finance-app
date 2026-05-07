import {
  NotificationLog,
  type NotificationType,
} from '../../../domain/aggregates/notification-log';
import { NotificationLogOrmEntity } from '../typeorm/notification-log.orm-entity';

export class NotificationLogMapper {
  static toDomain(ormEntity: NotificationLogOrmEntity): NotificationLog {
    return NotificationLog.reconstitute({
      id: ormEntity.id,
      userId: ormEntity.userId,
      type: ormEntity.type as NotificationType,
      dedupKey: ormEntity.dedupKey,
      payload: ormEntity.payload,
      sentAt: ormEntity.sentAt,
    });
  }

  static toOrm(log: NotificationLog): NotificationLogOrmEntity {
    const ormEntity = new NotificationLogOrmEntity();
    ormEntity.id = log.id;
    ormEntity.userId = log.userId;
    ormEntity.type = log.type;
    ormEntity.dedupKey = log.dedupKey;
    ormEntity.payload = log.payload;
    ormEntity.sentAt = log.sentAt;
    return ormEntity;
  }
}
