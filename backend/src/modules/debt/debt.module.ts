import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import { DEBT_REPOSITORY } from './domain/repositories';
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';
import { DebtOrmEntity } from './infrastructure/persistence/typeorm';
import { DebtRepository } from './infrastructure/persistence/repositories';
import { DebtsController } from './presentation/controllers';

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([DebtOrmEntity])],
  controllers: [DebtsController],
  providers: [
    { provide: DEBT_REPOSITORY, useClass: DebtRepository },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [DEBT_REPOSITORY],
})
export class DebtModule {}
