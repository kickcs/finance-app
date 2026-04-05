export * from './get-goals/get-goals.query';
export * from './get-goals/get-goals.handler';
export * from './get-goal-by-id/get-goal-by-id.query';
export * from './get-goal-by-id/get-goal-by-id.handler';
export * from './get-budget-for-month/get-budget-for-month.query';
export * from './get-budget-for-month/get-budget-for-month.handler';
export * from './get-budget-history/get-budget-history.query';
export * from './get-budget-history/get-budget-history.handler';

import { GetGoalsHandler } from './get-goals/get-goals.handler';
import { GetGoalByIdHandler } from './get-goal-by-id/get-goal-by-id.handler';
import { GetBudgetForMonthHandler } from './get-budget-for-month/get-budget-for-month.handler';
import { GetBudgetHistoryHandler } from './get-budget-history/get-budget-history.handler';

export const QueryHandlers = [
  GetGoalsHandler,
  GetGoalByIdHandler,
  GetBudgetForMonthHandler,
  GetBudgetHistoryHandler,
];
