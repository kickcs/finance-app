import type { NotificationLog } from '../aggregates/notification-log';

export const NOTIFICATION_LOG_REPOSITORY = Symbol('NOTIFICATION_LOG_REPOSITORY');

export interface INotificationLogRepository {
  tryRecord(log: NotificationLog): Promise<boolean>;
  findRecentByUserId(userId: string, limit: number): Promise<NotificationLog[]>;
}
