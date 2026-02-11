export * from './create-goal/create-goal.command';
export * from './create-goal/create-goal.handler';
export * from './update-goal/update-goal.command';
export * from './update-goal/update-goal.handler';
export * from './delete-goal/delete-goal.command';
export * from './delete-goal/delete-goal.handler';
export * from './create-reminder/create-reminder.command';
export * from './create-reminder/create-reminder.handler';
export * from './update-reminder/update-reminder.command';
export * from './update-reminder/update-reminder.handler';
export * from './delete-reminder/delete-reminder.command';
export * from './delete-reminder/delete-reminder.handler';

import { CreateGoalHandler } from './create-goal/create-goal.handler';
import { UpdateGoalHandler } from './update-goal/update-goal.handler';
import { DeleteGoalHandler } from './delete-goal/delete-goal.handler';
import { CreateReminderHandler } from './create-reminder/create-reminder.handler';
import { UpdateReminderHandler } from './update-reminder/update-reminder.handler';
import { DeleteReminderHandler } from './delete-reminder/delete-reminder.handler';

export const CommandHandlers = [
  CreateGoalHandler,
  UpdateGoalHandler,
  DeleteGoalHandler,
  CreateReminderHandler,
  UpdateReminderHandler,
  DeleteReminderHandler,
];
