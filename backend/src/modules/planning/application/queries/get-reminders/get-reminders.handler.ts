import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetRemindersQuery } from './get-reminders.query';
import {
  IReminderRepository,
  REMINDER_REPOSITORY,
} from '../../../domain/repositories';
import { ReminderResponseMapper } from '../../mappers';

@QueryHandler(GetRemindersQuery)
export class GetRemindersHandler implements IQueryHandler<GetRemindersQuery> {
  constructor(
    @Inject(REMINDER_REPOSITORY)
    private readonly reminderRepository: IReminderRepository,
  ) {}

  async execute(query: GetRemindersQuery) {
    const reminders = await this.reminderRepository.findByUserId(query.userId);
    return ReminderResponseMapper.toResponseList(reminders);
  }
}
