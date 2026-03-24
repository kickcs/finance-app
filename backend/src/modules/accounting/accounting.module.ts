import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

// Domain
import {
  ACCOUNT_REPOSITORY,
  TRANSACTION_REPOSITORY,
  CATEGORY_REPOSITORY,
  ACCOUNT_BALANCE_REPOSITORY,
  QUICK_ACTION_REPOSITORY,
} from './domain/repositories';

// Application
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';

// Infrastructure
import {
  AccountOrmEntity,
  AccountBalanceOrmEntity,
  TransactionOrmEntity,
  CategoryOrmEntity,
  QuickActionOrmEntity,
} from './infrastructure/persistence/typeorm';
import {
  AccountRepository,
  TransactionRepository,
  CategoryRepository,
  AccountBalanceRepository,
  QuickActionRepository,
} from './infrastructure/persistence/repositories';

// Cross-module
import { DebtModule } from '../debt/debt.module';
import { IdentityModule } from '../identity/identity.module';

// Presentation
import {
  AccountsController,
  TransactionsController,
  CategoriesController,
  AccountBalancesController,
  ImportController,
  QuickActionsController,
} from './presentation/controllers';

@Module({
  imports: [
    CqrsModule,
    DebtModule,
    forwardRef(() => IdentityModule),
    TypeOrmModule.forFeature([
      AccountOrmEntity,
      AccountBalanceOrmEntity,
      TransactionOrmEntity,
      CategoryOrmEntity,
      QuickActionOrmEntity,
    ]),
  ],
  controllers: [
    AccountsController,
    TransactionsController,
    CategoriesController,
    AccountBalancesController,
    ImportController,
    QuickActionsController,
  ],
  providers: [
    // Repositories
    {
      provide: ACCOUNT_REPOSITORY,
      useClass: AccountRepository,
    },
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: TransactionRepository,
    },
    {
      provide: CATEGORY_REPOSITORY,
      useClass: CategoryRepository,
    },
    {
      provide: ACCOUNT_BALANCE_REPOSITORY,
      useClass: AccountBalanceRepository,
    },
    {
      provide: QUICK_ACTION_REPOSITORY,
      useClass: QuickActionRepository,
    },

    // Command Handlers
    ...CommandHandlers,

    // Query Handlers
    ...QueryHandlers,
  ],
  exports: [
    ACCOUNT_REPOSITORY,
    TRANSACTION_REPOSITORY,
    CATEGORY_REPOSITORY,
    ACCOUNT_BALANCE_REPOSITORY,
    QUICK_ACTION_REPOSITORY,
  ],
})
export class AccountingModule {}
