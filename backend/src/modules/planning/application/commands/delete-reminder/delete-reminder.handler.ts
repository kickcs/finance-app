import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
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
    const exists = await this.reminderRepository.exists(command.id);
    if (!exists) {
      throw new NotFoundException('Reminder not found');
    }
    await this.reminderRepository.delete(command.id);
  }
}
