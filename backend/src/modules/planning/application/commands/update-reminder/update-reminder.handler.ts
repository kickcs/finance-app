import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UpdateReminderCommand } from './update-reminder.command';
import {
  IReminderRepository,
  REMINDER_REPOSITORY,
} from '../../../domain/repositories';
import { ReminderResponseMapper } from '../../mappers';

@CommandHandler(UpdateReminderCommand)
export class UpdateReminderHandler
  implements ICommandHandler<UpdateReminderCommand>
{
  constructor(
    @Inject(REMINDER_REPOSITORY)
    private readonly reminderRepository: IReminderRepository,
  ) {}

  async execute(command: UpdateReminderCommand) {
    const reminder = await this.reminderRepository.findById(command.id);
    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    if (reminder.userId !== command.userId) {
      throw new ForbiddenException('Access denied');
    }

    reminder.update(command.data);
    const savedReminder = await this.reminderRepository.save(reminder);

    return ReminderResponseMapper.toResponse(savedReminder);
  }
}
