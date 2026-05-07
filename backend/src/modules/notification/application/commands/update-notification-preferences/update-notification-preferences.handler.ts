import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateNotificationPreferencesCommand } from './update-notification-preferences.command';
import { NotificationPreferences } from '../../../domain/aggregates/notification-preferences';
import {
  INotificationPreferencesRepository,
  NOTIFICATION_PREFERENCES_REPOSITORY,
} from '../../../domain/repositories';
import { NotificationPreferencesResponse } from '../../types';

@CommandHandler(UpdateNotificationPreferencesCommand)
export class UpdateNotificationPreferencesHandler implements ICommandHandler<UpdateNotificationPreferencesCommand> {
  constructor(
    @Inject(NOTIFICATION_PREFERENCES_REPOSITORY)
    private readonly preferencesRepository: INotificationPreferencesRepository,
  ) {}

  async execute(
    command: UpdateNotificationPreferencesCommand,
  ): Promise<NotificationPreferencesResponse> {
    const existing = await this.preferencesRepository.findByUserId(command.userId);
    const prefs = existing ?? NotificationPreferences.createDefault(command.userId);

    prefs.update(command.payload);

    const saved = await this.preferencesRepository.save(prefs);
    return {
      subscriptionUpcoming: saved.subscriptionUpcoming,
      subscriptionCharged: saved.subscriptionCharged,
      subscriptionFailed: saved.subscriptionFailed,
    };
  }
}
