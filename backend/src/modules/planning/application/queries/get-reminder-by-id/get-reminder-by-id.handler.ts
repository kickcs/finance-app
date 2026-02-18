import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { GetReminderByIdQuery } from './get-reminder-by-id.query';
import {
  IReminderRepository,
  REMINDER_REPOSITORY,
} from '../../../domain/repositories';
import { ReminderResponseMapper } from '../../mappers';

@QueryHandler(GetReminderByIdQuery)
export class GetReminderByIdHandler
  implements IQueryHandler<GetReminderByIdQuery>
{
  constructor(
    @Inject(REMINDER_REPOSITORY)
    private readonly reminderRepository: IReminderRepository,
  ) {}

  async execute(query: GetReminderByIdQuery) {
    const reminder = await this.reminderRepository.findById(query.id);

    if (!reminder) {
      throw new NotFoundException(`Reminder with id ${query.id} not found`);
    }

    if (reminder.userId !== query.userId) {
      throw new ForbiddenException('Access denied');
    }

    return ReminderResponseMapper.toResponse(reminder);
  }
}
