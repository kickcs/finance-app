import {
  Reminder,
  ReminderFrequency,
} from '../../../domain/aggregates/reminder';
import { ReminderOrmEntity } from '../typeorm/reminder.orm-entity';

export class ReminderMapper {
  static toDomain(ormEntity: ReminderOrmEntity): Reminder {
    return Reminder.reconstitute({
      id: ormEntity.id,
      userId: ormEntity.userId,
      name: ormEntity.name,
      amount: Number(ormEntity.amount),
      frequency: ormEntity.frequency as ReminderFrequency,
      nextDate: ormEntity.nextDate,
      icon: ormEntity.icon,
      color: ormEntity.color,
      isActive: ormEntity.isActive,
      createdAt: ormEntity.createdAt,
    });
  }

  static toOrm(reminder: Reminder): ReminderOrmEntity {
    const ormEntity = new ReminderOrmEntity();
    ormEntity.id = reminder.id;
    ormEntity.userId = reminder.userId;
    ormEntity.name = reminder.name;
    ormEntity.amount = reminder.amount;
    ormEntity.frequency = reminder.frequency;
    ormEntity.nextDate = reminder.nextDate;
    ormEntity.icon = reminder.icon;
    ormEntity.color = reminder.color;
    ormEntity.isActive = reminder.isActive;
    ormEntity.createdAt = reminder.createdAt;
    return ormEntity;
  }
}
