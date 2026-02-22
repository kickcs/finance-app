import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import { GOAL_REPOSITORY, REMINDER_REPOSITORY } from './domain/repositories';
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';
import { GoalOrmEntity, ReminderOrmEntity } from './infrastructure/persistence/typeorm';
import { GoalRepository, ReminderRepository } from './infrastructure/persistence/repositories';
import { GoalsController, RemindersController } from './presentation/controllers';

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([GoalOrmEntity, ReminderOrmEntity])],
  controllers: [GoalsController, RemindersController],
  providers: [
    { provide: GOAL_REPOSITORY, useClass: GoalRepository },
    { provide: REMINDER_REPOSITORY, useClass: ReminderRepository },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [GOAL_REPOSITORY, REMINDER_REPOSITORY],
})
export class PlanningModule {}
