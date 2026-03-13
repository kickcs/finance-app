import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import { BUDGET_REPOSITORY, GOAL_REPOSITORY, REMINDER_REPOSITORY } from './domain/repositories';
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';
import {
  BudgetOrmEntity,
  GoalOrmEntity,
  ReminderOrmEntity,
} from './infrastructure/persistence/typeorm';
import {
  BudgetRepository,
  GoalRepository,
  ReminderRepository,
} from './infrastructure/persistence/repositories';
import {
  BudgetsController,
  GoalsController,
  RemindersController,
} from './presentation/controllers';
import { AccountingModule } from '../accounting/accounting.module';
import { ExchangeModule } from '../exchange/exchange.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    CqrsModule,
    AccountingModule,
    ExchangeModule,
    forwardRef(() => IdentityModule),
    TypeOrmModule.forFeature([BudgetOrmEntity, GoalOrmEntity, ReminderOrmEntity]),
  ],
  controllers: [BudgetsController, GoalsController, RemindersController],
  providers: [
    { provide: BUDGET_REPOSITORY, useClass: BudgetRepository },
    { provide: GOAL_REPOSITORY, useClass: GoalRepository },
    { provide: REMINDER_REPOSITORY, useClass: ReminderRepository },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [BUDGET_REPOSITORY, GOAL_REPOSITORY, REMINDER_REPOSITORY],
})
export class PlanningModule {}
