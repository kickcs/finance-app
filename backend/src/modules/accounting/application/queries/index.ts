// Account queries
export * from './get-accounts/get-accounts.query';
export * from './get-accounts/get-accounts.handler';
export * from './get-account-by-id/get-account-by-id.query';
export * from './get-account-by-id/get-account-by-id.handler';

// Transaction queries
export * from './get-transactions-paginated/get-transactions-paginated.query';
export * from './get-transactions-paginated/get-transactions-paginated.handler';
export * from './get-monthly-stats/get-monthly-stats.query';
export * from './get-monthly-stats/get-monthly-stats.handler';
export * from './get-analytics-stats/get-analytics-stats.query';
export * from './get-analytics-stats/get-analytics-stats.handler';
export * from './get-transaction-by-id/get-transaction-by-id.query';
export * from './get-transaction-by-id/get-transaction-by-id.handler';
export * from './get-transactions-by-date-range/get-transactions-by-date-range.query';
export * from './get-transactions-by-date-range/get-transactions-by-date-range.handler';
export * from './get-transactions-by-account/get-transactions-by-account.query';
export * from './get-transactions-by-account/get-transactions-by-account.handler';
export * from './get-transactions-by-account-with-incoming/get-transactions-by-account-with-incoming.query';
export * from './get-transactions-by-account-with-incoming/get-transactions-by-account-with-incoming.handler';
export * from './get-transactions-by-account-paginated/get-transactions-by-account-paginated.query';
export * from './get-transactions-by-account-paginated/get-transactions-by-account-paginated.handler';
export * from './count-transactions-by-account/count-transactions-by-account.query';
export * from './count-transactions-by-account/count-transactions-by-account.handler';

// Category queries
export * from './get-categories/get-categories.query';
export * from './get-categories/get-categories.handler';

// Hashtag queries
export * from './get-hashtags/get-hashtags.query';
export * from './get-hashtags/get-hashtags.handler';

// Quick Action queries
export * from './get-quick-actions/get-quick-actions.query';
export * from './get-quick-actions/get-quick-actions.handler';

// Account Balance queries
export * from './get-balances-by-account/get-balances-by-account.query';
export * from './get-balances-by-account/get-balances-by-account.handler';
export * from './get-balances-by-accounts/get-balances-by-accounts.query';
export * from './get-balances-by-accounts/get-balances-by-accounts.handler';

// Import handlers for module registration
import { GetAccountsHandler } from './get-accounts/get-accounts.handler';
import { GetAccountByIdHandler } from './get-account-by-id/get-account-by-id.handler';
import { GetTransactionsPaginatedHandler } from './get-transactions-paginated/get-transactions-paginated.handler';
import { GetMonthlyStatsHandler } from './get-monthly-stats/get-monthly-stats.handler';
import { GetAnalyticsStatsHandler } from './get-analytics-stats/get-analytics-stats.handler';
import { GetCategoriesHandler } from './get-categories/get-categories.handler';
import { GetTransactionByIdHandler } from './get-transaction-by-id/get-transaction-by-id.handler';
import { GetTransactionsByDateRangeHandler } from './get-transactions-by-date-range/get-transactions-by-date-range.handler';
import { GetTransactionsByAccountHandler } from './get-transactions-by-account/get-transactions-by-account.handler';
import { GetTransactionsByAccountWithIncomingHandler } from './get-transactions-by-account-with-incoming/get-transactions-by-account-with-incoming.handler';
import { GetTransactionsByAccountPaginatedHandler } from './get-transactions-by-account-paginated/get-transactions-by-account-paginated.handler';
import { GetBalancesByAccountHandler } from './get-balances-by-account/get-balances-by-account.handler';
import { GetBalancesByAccountsHandler } from './get-balances-by-accounts/get-balances-by-accounts.handler';
import { CountTransactionsByAccountHandler } from './count-transactions-by-account/count-transactions-by-account.handler';
import { GetHashtagsHandler } from './get-hashtags/get-hashtags.handler';
import { GetQuickActionsHandler } from './get-quick-actions/get-quick-actions.handler';

export const QueryHandlers = [
  GetAccountsHandler,
  GetAccountByIdHandler,
  GetTransactionsPaginatedHandler,
  GetMonthlyStatsHandler,
  GetAnalyticsStatsHandler,
  GetCategoriesHandler,
  GetTransactionByIdHandler,
  GetTransactionsByDateRangeHandler,
  GetTransactionsByAccountHandler,
  GetTransactionsByAccountWithIncomingHandler,
  GetTransactionsByAccountPaginatedHandler,
  GetBalancesByAccountHandler,
  GetBalancesByAccountsHandler,
  CountTransactionsByAccountHandler,
  GetHashtagsHandler,
  GetQuickActionsHandler,
];
