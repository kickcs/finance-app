import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeleteReminderCommand } from './delete-reminder.command';
import {
  IReminderRepository,
  REMINDER_REPOSITORY,
} from '../../../domain/repositories';

@CommandHandler(DeleteReminderCommand)
export class DeleteReminderHandler implements ICommandHandler<DeleteReminderCommand> {
  constructor(
    @Inject(REMINDER_REPOSITORY)
    private readonly reminderRepository: IReminderRepository,
  ) {}

  async execute(command: DeleteReminderCommand): Promise<void> {
    const reminder = await this.reminderRepository.findById(command.id);
    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }
    if (reminder.userId !== command.userId) {
      throw new ForbiddenException('Access denied');
    }
    await this.reminderRepository.delete(command.id);
  }
}
