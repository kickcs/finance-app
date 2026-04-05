export * from './create-goal/create-goal.command';
export * from './create-goal/create-goal.handler';
export * from './update-goal/update-goal.command';
export * from './update-goal/update-goal.handler';
export * from './delete-goal/delete-goal.command';
export * from './delete-goal/delete-goal.handler';
export * from './set-default-budget/set-default-budget.command';
export * from './set-default-budget/set-default-budget.handler';
export * from './set-monthly-budget-override/set-monthly-budget-override.command';
export * from './set-monthly-budget-override/set-monthly-budget-override.handler';
export * from './remove-monthly-budget-override/remove-monthly-budget-override.command';
export * from './remove-monthly-budget-override/remove-monthly-budget-override.handler';

import { CreateGoalHandler } from './create-goal/create-goal.handler';
import { UpdateGoalHandler } from './update-goal/update-goal.handler';
import { DeleteGoalHandler } from './delete-goal/delete-goal.handler';
import { SetDefaultBudgetHandler } from './set-default-budget/set-default-budget.handler';
import { SetMonthlyBudgetOverrideHandler } from './set-monthly-budget-override/set-monthly-budget-override.handler';
import { RemoveMonthlyBudgetOverrideHandler } from './remove-monthly-budget-override/remove-monthly-budget-override.handler';

export const CommandHandlers = [
  CreateGoalHandler,
  UpdateGoalHandler,
  DeleteGoalHandler,
  SetDefaultBudgetHandler,
  SetMonthlyBudgetOverrideHandler,
  RemoveMonthlyBudgetOverrideHandler,
];
