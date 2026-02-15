// Account commands
export * from './create-account/create-account.command';
export * from './create-account/create-account.handler';
export * from './update-account/update-account.command';
export * from './update-account/update-account.handler';
export * from './delete-account/delete-account.command';
export * from './delete-account/delete-account.handler';
export * from './reorder-accounts/reorder-accounts.command';
export * from './reorder-accounts/reorder-accounts.handler';

// Transaction commands
export * from './create-transaction/create-transaction.command';
export * from './create-transaction/create-transaction.handler';
export * from './update-transaction/update-transaction.command';
export * from './update-transaction/update-transaction.handler';
export * from './delete-transaction/delete-transaction.command';
export * from './delete-transaction/delete-transaction.handler';

// Category commands
export * from './create-category/create-category.command';
export * from './create-category/create-category.handler';
export * from './update-category/update-category.command';
export * from './update-category/update-category.handler';
export * from './delete-category/delete-category.command';
export * from './delete-category/delete-category.handler';
export * from './reorder-categories/reorder-categories.command';
export * from './reorder-categories/reorder-categories.handler';
export * from './initialize-default-categories/initialize-default-categories.command';
export * from './initialize-default-categories/initialize-default-categories.handler';

// Bulk import commands
export * from './bulk-import/bulk-import.command';
export * from './bulk-import/bulk-import.handler';

// Account Balance commands
export * from './upsert-balance/upsert-balance.command';
export * from './upsert-balance/upsert-balance.handler';
export * from './create-many-balances/create-many-balances.command';
export * from './create-many-balances/create-many-balances.handler';
export * from './update-balance-by-delta/update-balance-by-delta.command';
export * from './update-balance-by-delta/update-balance-by-delta.handler';
export * from './delete-balance/delete-balance.command';
export * from './delete-balance/delete-balance.handler';
export * from './delete-balances-by-account/delete-balances-by-account.command';
export * from './delete-balances-by-account/delete-balances-by-account.handler';

// Import handlers for module registration
import { CreateAccountHandler } from './create-account/create-account.handler';
import { UpdateAccountHandler } from './update-account/update-account.handler';
import { DeleteAccountHandler } from './delete-account/delete-account.handler';
import { ReorderAccountsHandler } from './reorder-accounts/reorder-accounts.handler';
import { CreateTransactionHandler } from './create-transaction/create-transaction.handler';
import { UpdateTransactionHandler } from './update-transaction/update-transaction.handler';
import { DeleteTransactionHandler } from './delete-transaction/delete-transaction.handler';
import { CreateCategoryHandler } from './create-category/create-category.handler';
import { UpdateCategoryHandler } from './update-category/update-category.handler';
import { DeleteCategoryHandler } from './delete-category/delete-category.handler';
import { ReorderCategoriesHandler } from './reorder-categories/reorder-categories.handler';
import { InitializeDefaultCategoriesHandler } from './initialize-default-categories/initialize-default-categories.handler';
import { UpsertBalanceHandler } from './upsert-balance/upsert-balance.handler';
import { CreateManyBalancesHandler } from './create-many-balances/create-many-balances.handler';
import { UpdateBalanceByDeltaHandler } from './update-balance-by-delta/update-balance-by-delta.handler';
import { DeleteBalanceHandler } from './delete-balance/delete-balance.handler';
import { DeleteBalancesByAccountHandler } from './delete-balances-by-account/delete-balances-by-account.handler';
import { BulkImportHandler } from './bulk-import/bulk-import.handler';

export const CommandHandlers = [
  CreateAccountHandler,
  UpdateAccountHandler,
  DeleteAccountHandler,
  ReorderAccountsHandler,
  CreateTransactionHandler,
  UpdateTransactionHandler,
  DeleteTransactionHandler,
  CreateCategoryHandler,
  UpdateCategoryHandler,
  DeleteCategoryHandler,
  ReorderCategoriesHandler,
  InitializeDefaultCategoriesHandler,
  UpsertBalanceHandler,
  CreateManyBalancesHandler,
  UpdateBalanceByDeltaHandler,
  DeleteBalanceHandler,
  DeleteBalancesByAccountHandler,
  BulkImportHandler,
];
