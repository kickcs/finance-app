import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, ForbiddenException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { UndoBulkUpdateCommand } from './undo-bulk-update.command';
import {
  bulkUndoKey,
  verifyBulkUndoToken,
  type BulkUndoRowState,
} from '../../bulk/bulk-undo.token';
import { sameRowState, snapshotRow, undoBalanceDeltas } from '../../bulk/bulk-row-state';
import { AccountUnitOfWork } from '../../helpers/account-unit-of-work';
import { lockBulkOperations } from '../../bulk/bulk-user-lock';
import { runBulkTransaction } from '../../bulk/bulk-transaction';
import type { Transaction } from '../../../domain/aggregates/transaction';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';

@CommandHandler(UndoBulkUpdateCommand)
export class UndoBulkUpdateHandler implements ICommandHandler<
  UndoBulkUpdateCommand,
  { restored: number }
> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: UndoBulkUpdateCommand): Promise<{ restored: number }> {
    const { userId } = command;
    const payload = verifyBulkUndoToken(
      command.undoToken,
      bulkUndoKey(this.configService),
      new Date(),
    );
    if (payload.userId !== userId) {
      throw new ForbiddenException('Undo token was issued to another user');
    }

    await runBulkTransaction(this.dataSource, this.eventPublisher, async (manager, changed) => {
      await lockBulkOperations(manager, userId);

      const locked = await this.transactionRepository.findByIdsForUpdate(
        payload.rows.map((row) => row.id),
        userId,
        manager,
      );
      const byId = new Map(locked.map((transaction) => [transaction.id, transaction]));

      // Сверка до первой записи: одна изменённая строка отменяет отмену целиком.
      const untouched = payload.rows.every((row) => {
        const current = byId.get(row.id);
        return current !== undefined && sameRowState(snapshotRow(current), row.after);
      });
      if (!untouched) {
        throw new ConflictException(
          'Операции уже изменились после правки, поэтому отменить её нельзя',
        );
      }

      const restored = payload.rows.map((row) => {
        const transaction = byId.get(row.id)!;
        restoreRow(transaction, row.before);
        return transaction;
      });

      const accounts = new AccountUnitOfWork(this.accountRepository, manager, userId);
      await accounts.apply(undoBalanceDeltas(payload.rows));
      changed.push(...(await accounts.saveChanged()));

      await this.transactionRepository.saveMany(restored, manager);
      changed.push(...restored);
    });

    return { restored: payload.rows.length };
  }
}

/** Возвращает поля, которые меняла массовая правка; сумма и валюта правкой не менялись. */
function restoreRow(transaction: Transaction, before: BulkUndoRowState): void {
  // Из пары выходят до правки, в пару возвращаются после: агрегат пускает в неё только доход и расход.
  if (before.paymentGroupId === null) transaction.leavePaymentGroup();
  transaction.update({
    categoryId: before.categoryId,
    accountId: before.accountId,
    description: before.description,
    type: before.type,
    isDebtRelated: before.isDebtRelated,
    toAccountId: before.toAccountId,
    toAmount: before.toAmount,
    toCurrency: before.toCurrency,
  });
  if (before.paymentGroupId !== null) transaction.joinPaymentGroup(before.paymentGroupId);
}
