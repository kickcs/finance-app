import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from '../../../domain/aggregates/notification-log';
import { INotificationLogRepository } from '../../../domain/repositories';
import { NotificationLogOrmEntity } from '../typeorm/notification-log.orm-entity';
import { NotificationLogMapper } from '../mappers/notification-log.mapper';

@Injectable()
export class NotificationLogRepository implements INotificationLogRepository {
  constructor(
    @InjectRepository(NotificationLogOrmEntity)
    private readonly ormRepository: Repository<NotificationLogOrmEntity>,
  ) {}

  async tryRecord(log: NotificationLog): Promise<boolean> {
    const result: Array<{ id: string }> = await this.ormRepository.query(
      `
        INSERT INTO "notification_log" ("id", "user_id", "type", "dedup_key", "payload", "sent_at")
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ("user_id", "dedup_key") DO NOTHING
        RETURNING "id"
      `,
      [
        log.id,
        log.userId,
        log.type,
        log.dedupKey,
        log.payload === null ? null : JSON.stringify(log.payload),
        log.sentAt,
      ],
    );
    return result.length > 0;
  }

  async findRecentByUserId(userId: string, limit: number): Promise<NotificationLog[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
      order: { sentAt: 'DESC' },
      take: limit,
    });
    return ormEntities.map((entity) => NotificationLogMapper.toDomain(entity));
  }
}
