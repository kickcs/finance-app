import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetReminderByIdQuery } from './get-reminder-by-id.query';
import {
  IReminderRepository,
  REMINDER_REPOSITORY,
} from '../../../domain/repositories';

@QueryHandler(GetReminderByIdQuery)
export class GetReminderByIdHandler implements IQueryHandler<GetReminderByIdQuery> {
  constructor(
    @Inject(REMINDER_REPOSITORY)
    private readonly reminderRepository: IReminderRepository,
  ) {}

  async execute(query: GetReminderByIdQuery) {
    const reminder = await this.reminderRepository.findById(query.id);

    if (!reminder) {
      throw new NotFoundException(`Reminder with id ${query.id} not found`);
    }

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
}
