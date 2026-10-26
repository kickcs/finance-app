import { randomUUID } from 'crypto';
import type { CommandBus } from '@nestjs/cqrs';
import type { EntityManager } from 'typeorm';
import type { Debt } from '../../domain/aggregates/debt';
import type { IDebtRepository } from '../../domain/repositories';
import { CreateTransactionCommand } from '../../../accounting/application/commands/create-transaction/create-transaction.command';

export interface SettlementRecordInput {
  accountId: string;
  categoryId: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense';
  date: Date;
  description: string;
  isDebtRelated: boolean;
  debtId?: string;
  isInformational?: boolean;
}

/**
 * Единственное место, где записи расчёта получают `settlement_id`: все записи
 * одного платежа или зачёта идут через один писатель и одну транзакцию БД.
 */
export class SettlementWriter {
  readonly settlementId: string = randomUUID();

  constructor(
    private readonly commandBus: CommandBus,
    private readonly debtRepository: IDebtRepository,
    readonly manager: EntityManager,
    readonly userId: string,
  ) {}

  /** Создаёт запись расчёта и возвращает её id. */
  async record(input: SettlementRecordInput): Promise<string> {
    const created = await this.commandBus.execute<CreateTransactionCommand, { id: string }>(
      new CreateTransactionCommand(
        this.userId,
        input.accountId,
        input.categoryId,
        input.amount,
        input.currency,
        input.type,
        input.date,
        input.description,
        input.isDebtRelated,
        undefined,
        undefined,
        undefined,
        input.debtId,
        undefined,
        this.manager,
        input.isInformational ?? false,
        undefined,
        this.settlementId,
      ),
    );
    return created.id;
  }

  /** Сохраняет долг в той же транзакции, что и записи расчёта. */
  async saveDebt(debt: Debt): Promise<void> {
    await this.debtRepository.save(debt, this.manager);
  }
}
