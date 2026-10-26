import type { CommandBus } from '@nestjs/cqrs';
import type { DataSource } from 'typeorm';
import type { IDebtRepository } from '../../domain/repositories';

/** Зависимости расчётов, которые сервис передаёт функциям папки. */
export interface SettlementDeps {
  debtRepository: IDebtRepository;
  commandBus: CommandBus;
  dataSource: DataSource;
}
