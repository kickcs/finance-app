import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateReminderCommand } from './create-reminder.command';
import { Reminder } from '../../../domain/aggregates/reminder';
import {
  IReminderRepository,
  REMINDER_REPOSITORY,
} from '../../../domain/repositories';

@CommandHandler(CreateReminderCommand)
export class CreateReminderHandler implements ICommandHandler<CreateReminderCommand> {
  constructor(
    @Inject(REMINDER_REPOSITORY)
    private readonly reminderRepository: IReminderRepository,
  ) {}

  async execute(command: CreateReminderCommand) {
    const reminder = Reminder.create(
      crypto.randomUUID(),
      command.userId,
      command.name,
      command.amount,
      command.frequency,
      command.nextDate,
      command.icon,
      command.color,
    );

    const savedReminder = await this.reminderRepository.save(reminder);

    return this.toResponse(savedReminder);
  }

  private toResponse(reminder: Reminder) {
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
