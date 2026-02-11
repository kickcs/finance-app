import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetRemindersQuery } from './get-reminders.query';
import {
  IReminderRepository,
  REMINDER_REPOSITORY,
} from '../../../domain/repositories';

@QueryHandler(GetRemindersQuery)
export class GetRemindersHandler implements IQueryHandler<GetRemindersQuery> {
  constructor(
    @Inject(REMINDER_REPOSITORY)
    private readonly reminderRepository: IReminderRepository,
  ) {}

  async execute(query: GetRemindersQuery) {
    const reminders = await this.reminderRepository.findByUserId(query.userId);
    return reminders.map((reminder) => ({
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
    }));
  }
}
