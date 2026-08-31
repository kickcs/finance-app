import { Injectable, BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { EntityManager } from 'typeorm';
import { Debt } from '../../domain/aggregates/debt';
import { CreateTransactionCommand } from '../../../accounting/application/commands/create-transaction/create-transaction.command';
import { UpdateTransactionCommand } from '../../../accounting/application/commands/update-transaction/update-transaction.command';
import { DeleteTransactionCommand } from '../../../accounting/application/commands/delete-transaction/delete-transaction.command';
import {
  FEE_CATEGORY_ID,
  FEE_DESCRIPTION,
} from '../../../accounting/domain/constants/default-categories';

/**
 * Комиссия за выдачу долга: сумма на долге и расходная запись за ней.
 *
 * Раньше запись заводил `POST /transactions` по полю `feeAmount`, а число
 * ложилось на долг отдельным запросом — связи между ними не оставалось, и
 * исправить комиссию было нечем. Теперь обе половины меняются одним вызовом,
 * и создание с редактированием ходят через него же.
 */
@Injectable()
export class DebtFeeService {
  constructor(private readonly commandBus: CommandBus) {}

  /**
   * Приводит комиссию долга к сумме `amount`: заводит запись, правит её или
   * убирает. Долг только мутируется — сохраняет его вызывающий.
   */
  async apply(debt: Debt, amount: number, manager?: EntityManager): Promise<void> {
    const next = Math.max(0, amount);
    if (next === debt.feeAmount) return;

    const existing = debt.feeTransactionId;
    // Комиссии, заведённые до появления связи, живут отдельной записью, найти
    // которую нечем: правка создала бы вторую вдобавок к уже списанной.
    if (debt.feeAmount > 0 && !existing) {
      throw new BadRequestException('Комиссию этого долга изменить нельзя');
    }

    if (next === 0) {
      if (existing) {
        await this.commandBus.execute(new DeleteTransactionCommand(existing, debt.userId, true));
      }
      debt.setFee(0, null);
      return;
    }

    if (existing) {
      await this.commandBus.execute(
        new UpdateTransactionCommand(existing, debt.userId, { amount: next }),
      );
      debt.setFee(next, existing);
      return;
    }

    if (!debt.accountId) {
      throw new BadRequestException('Комиссию не с чего списать: у долга нет счёта');
    }

    const created = await this.commandBus.execute<CreateTransactionCommand, { id: string }>(
      new CreateTransactionCommand(
        debt.userId,
        debt.accountId,
        FEE_CATEGORY_ID,
        next,
        debt.currency,
        'expense',
        debt.createdAt,
        FEE_DESCRIPTION,
        // Намеренно не долговая и без `debtId`: иначе комиссия попала бы в
        // ленту платежей по долгу и считалась бы возвращёнными деньгами.
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        manager,
      ),
    );

    debt.setFee(next, created.id);
  }
}
