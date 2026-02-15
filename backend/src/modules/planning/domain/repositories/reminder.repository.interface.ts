import type { Reminder } from '../aggregates/reminder';

export const REMINDER_REPOSITORY = Symbol('REMINDER_REPOSITORY');

export interface IReminderRepository {
  findById(id: string): Promise<Reminder | null>;
  findByUserId(userId: string): Promise<Reminder[]>;
  findActiveByUserId(userId: string): Promise<Reminder[]>;
  findDueReminders(userId: string): Promise<Reminder[]>;
  save(reminder: Reminder): Promise<Reminder>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
