import type { Reminder } from '../../domain/aggregates/reminder';

export class ReminderResponseMapper {
  static toResponse(reminder: Reminder) {
    return {
      id: reminder.id,
      userId: reminder.userId,
      name: reminder.name,
      amount: reminder.amount,
      frequency: reminder.frequency,
      nextDate: reminder.nextDate,
      icon: reminder.icon,
      color: reminder.color,
      isActive: reminder.isActive,
      isDue: reminder.isDue,
      createdAt: reminder.createdAt,
    };
  }

  static toResponseList(reminders: Reminder[]) {
    return reminders.map((reminder) => ReminderResponseMapper.toResponse(reminder));
  }
}
