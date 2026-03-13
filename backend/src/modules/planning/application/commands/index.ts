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
export * from './set-default-budget/set-default-budget.command';
export * from './set-default-budget/set-default-budget.handler';
export * from './set-monthly-budget-override/set-monthly-budget-override.command';
export * from './set-monthly-budget-override/set-monthly-budget-override.handler';
export * from './remove-monthly-budget-override/remove-monthly-budget-override.command';
export * from './remove-monthly-budget-override/remove-monthly-budget-override.handler';

import { CreateGoalHandler } from './create-goal/create-goal.handler';
import { UpdateGoalHandler } from './update-goal/update-goal.handler';
import { DeleteGoalHandler } from './delete-goal/delete-goal.handler';
import { CreateReminderHandler } from './create-reminder/create-reminder.handler';
import { UpdateReminderHandler } from './update-reminder/update-reminder.handler';
import { DeleteReminderHandler } from './delete-reminder/delete-reminder.handler';
import { SetDefaultBudgetHandler } from './set-default-budget/set-default-budget.handler';
import { SetMonthlyBudgetOverrideHandler } from './set-monthly-budget-override/set-monthly-budget-override.handler';
import { RemoveMonthlyBudgetOverrideHandler } from './remove-monthly-budget-override/remove-monthly-budget-override.handler';

export const CommandHandlers = [
  CreateGoalHandler,
  UpdateGoalHandler,
  DeleteGoalHandler,
  CreateReminderHandler,
  UpdateReminderHandler,
  DeleteReminderHandler,
  SetDefaultBudgetHandler,
  SetMonthlyBudgetOverrideHandler,
  RemoveMonthlyBudgetOverrideHandler,
];
