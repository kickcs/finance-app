import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import { DEBT_REPOSITORY } from './domain/repositories';
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';
import { SharedDebtsService } from './application/services/shared-debts.service';
import { DebtsOgImageService } from './application/services/debts-og-image.service';
import { DebtFeeService } from './application/services/debt-fee.service';
import { DebtOrmEntity, SharedDebtsOrmEntity } from './infrastructure/persistence/typeorm';
import { DebtRepository } from './infrastructure/persistence/repositories';
import {
  DebtsController,
  SharedDebtsController,
  DebtsSharePageController,
} from './presentation/controllers';

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([DebtOrmEntity, SharedDebtsOrmEntity])],
  controllers: [DebtsController, SharedDebtsController, DebtsSharePageController],
  providers: [
    { provide: DEBT_REPOSITORY, useClass: DebtRepository },
    SharedDebtsService,
    DebtsOgImageService,
    DebtFeeService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [DEBT_REPOSITORY],
})
export class DebtModule {}
