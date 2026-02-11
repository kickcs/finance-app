import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

// Domain
import {
  ACCOUNT_REPOSITORY,
  TRANSACTION_REPOSITORY,
  CATEGORY_REPOSITORY,
  ACCOUNT_BALANCE_REPOSITORY,
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
} from './infrastructure/persistence/typeorm';
import {
  AccountRepository,
  TransactionRepository,
  CategoryRepository,
  AccountBalanceRepository,
} from './infrastructure/persistence/repositories';

// Presentation
import {
  AccountsController,
  TransactionsController,
  CategoriesController,
  AccountBalancesController,
} from './presentation/controllers';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      AccountOrmEntity,
      AccountBalanceOrmEntity,
      TransactionOrmEntity,
      CategoryOrmEntity,
    ]),
  ],
  controllers: [
    AccountsController,
    TransactionsController,
    CategoriesController,
    AccountBalancesController,
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
  ],
})
export class AccountingModule {}
