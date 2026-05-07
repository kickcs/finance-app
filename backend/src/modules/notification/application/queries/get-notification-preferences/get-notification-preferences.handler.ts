import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetNotificationPreferencesQuery } from './get-notification-preferences.query';
import { NotificationPreferences } from '../../../domain/aggregates/notification-preferences';
import {
  INotificationPreferencesRepository,
  NOTIFICATION_PREFERENCES_REPOSITORY,
} from '../../../domain/repositories';
import { NotificationPreferencesResponse } from '../../types';

@QueryHandler(GetNotificationPreferencesQuery)
export class GetNotificationPreferencesHandler implements IQueryHandler<GetNotificationPreferencesQuery> {
  constructor(
    @Inject(NOTIFICATION_PREFERENCES_REPOSITORY)
    private readonly preferencesRepository: INotificationPreferencesRepository,
  ) {}

  async execute(query: GetNotificationPreferencesQuery): Promise<NotificationPreferencesResponse> {
    const prefs =
      (await this.preferencesRepository.findByUserId(query.userId)) ??
      NotificationPreferences.createDefault(query.userId);
    return {
      subscriptionUpcoming: prefs.subscriptionUpcoming,
      subscriptionCharged: prefs.subscriptionCharged,
      subscriptionFailed: prefs.subscriptionFailed,
    };
  }
}
