import type { RequestHandler } from 'msw';
import { accountHandlers } from './handlers/accounts';
import { analyticsHandlers } from './handlers/analytics';
import { budgetHandlers } from './handlers/budgets';
import { categoryHandlers } from './handlers/categories';
import { debtHandlers } from './handlers/debts';
import { exchangeRateHandlers } from './handlers/exchange-rates';
import { peopleHandlers } from './handlers/people';
import { profileHandlers } from './handlers/profiles';
import { quickActionHandlers } from './handlers/quick-actions';
import { subscriptionHandlers } from './handlers/subscription';
import { transactionHandlers } from './handlers/transactions';

export const handlers: RequestHandler[] = [
  ...accountHandlers,
  ...analyticsHandlers,
  ...budgetHandlers,
  ...categoryHandlers,
  ...debtHandlers,
  ...exchangeRateHandlers,
  ...peopleHandlers,
  ...profileHandlers,
  ...quickActionHandlers,
  ...subscriptionHandlers,
  ...transactionHandlers,
];
