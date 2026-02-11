export * from './get-goals/get-goals.query';
export * from './get-goals/get-goals.handler';
export * from './get-goal-by-id/get-goal-by-id.query';
export * from './get-goal-by-id/get-goal-by-id.handler';
export * from './get-reminders/get-reminders.query';
export * from './get-reminders/get-reminders.handler';
export * from './get-reminder-by-id/get-reminder-by-id.query';
export * from './get-reminder-by-id/get-reminder-by-id.handler';

import { GetGoalsHandler } from './get-goals/get-goals.handler';
import { GetGoalByIdHandler } from './get-goal-by-id/get-goal-by-id.handler';
import { GetRemindersHandler } from './get-reminders/get-reminders.handler';
import { GetReminderByIdHandler } from './get-reminder-by-id/get-reminder-by-id.handler';

export const QueryHandlers = [
  GetGoalsHandler,
  GetGoalByIdHandler,
  GetRemindersHandler,
  GetReminderByIdHandler,
];
