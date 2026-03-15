import type { RequestHandler } from 'msw';
import { accountHandlers } from './handlers/accounts';
import { categoryHandlers } from './handlers/categories';
import { debtHandlers } from './handlers/debts';
import { exchangeRateHandlers } from './handlers/exchange-rates';
import { peopleHandlers } from './handlers/people';
import { profileHandlers } from './handlers/profiles';
import { transactionHandlers } from './handlers/transactions';

export const handlers: RequestHandler[] = [
  ...accountHandlers,
  ...categoryHandlers,
  ...debtHandlers,
  ...exchangeRateHandlers,
  ...peopleHandlers,
  ...profileHandlers,
  ...transactionHandlers,
];
