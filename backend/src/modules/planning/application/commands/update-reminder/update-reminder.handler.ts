import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateReminderCommand } from './update-reminder.command';
import {
  IReminderRepository,
  REMINDER_REPOSITORY,
} from '../../../domain/repositories';

@CommandHandler(UpdateReminderCommand)
export class UpdateReminderHandler implements ICommandHandler<UpdateReminderCommand> {
  constructor(
    @Inject(REMINDER_REPOSITORY)
    private readonly reminderRepository: IReminderRepository,
  ) {}

  async execute(command: UpdateReminderCommand) {
    const reminder = await this.reminderRepository.findById(command.id);
    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    reminder.update(command.data);
    const savedReminder = await this.reminderRepository.save(reminder);

    return {
      id: savedReminder.id,
      userId: savedReminder.userId,
      name: savedReminder.name,
      amount: savedReminder.amount,
      frequency: savedReminder.frequency,
      nextDate: savedReminder.nextDate,
      icon: savedReminder.icon,
      color: savedReminder.color,
      isActive: savedReminder.isActive,
      isDue: savedReminder.isDue,
      createdAt: savedReminder.createdAt,
    };
  }
}
