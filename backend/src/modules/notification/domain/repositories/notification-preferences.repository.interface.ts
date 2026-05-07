import type { NotificationPreferences } from '../aggregates/notification-preferences';

export const NOTIFICATION_PREFERENCES_REPOSITORY = Symbol('NOTIFICATION_PREFERENCES_REPOSITORY');

export interface INotificationPreferencesRepository {
  findByUserId(userId: string): Promise<NotificationPreferences | null>;
  save(prefs: NotificationPreferences): Promise<NotificationPreferences>;
}
