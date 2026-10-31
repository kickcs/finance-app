import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, ConflictException, ForbiddenException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import { isUUID } from 'class-validator';
import {
  BulkUpdateTransactionsCommand,
  MAX_BULK_ROWS,
  type BulkSelectionInput,
  type BulkUpdateResult,
} from './bulk-update-transactions.command';
import { planBulk, type BulkContext, type BulkItem, type BulkPlan } from './bulk-plan';
import { AccountUnitOfWork } from '../../helpers/account-unit-of-work';
import { lockBulkOperations } from '../../bulk/bulk-user-lock';
import { runBulkTransaction } from '../../bulk/bulk-transaction';
import { bulkUndoKey, signBulkUndoToken, type BulkUndoRow } from '../../bulk/bulk-undo.token';
import { snapshotRow } from '../../bulk/bulk-row-state';
import type { Transaction } from '../../../domain/aggregates/transaction';
import {
  getDefaultCategoryById,
  TRANSFER_CATEGORY_ID,
} from '../../../domain/constants/default-categories';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
  type BulkRow,
  type BulkSelectionResult,
} from '../../../domain/repositories/transaction.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import {
  ICategoryRepository,
  CATEGORY_REPOSITORY,
} from '../../../domain/repositories/category.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import type { AggregateRoot } from '../../../../../shared/domain/base';

@CommandHandler(BulkUpdateTransactionsCommand)
export class BulkUpdateTransactionsHandler implements ICommandHandler<
  BulkUpdateTransactionsCommand,
  BulkUpdateResult
> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: BulkUpdateTransactionsCommand): Promise<BulkUpdateResult> {
    const { userId, action, dryRun } = command;

    // Предпросмотр идёт тем же путём, что и применение: до записи различаются только замки и сама запись.
    return runBulkTransaction(this.dataSource, this.eventPublisher, async (manager, changed) => {
      if (!dryRun) await lockBulkOperations(manager, userId);

      const accounts = new AccountUnitOfWork(this.accountRepository, manager, userId);
      if (action.kind === 'transfer') await accounts.get(action.toAccountId);
      if (action.kind === 'account') await accounts.get(action.accountId);
      const context: BulkContext = { targetCategory: await this.resolveTargetCategory(command) };

      const loaded = await this.loadSelection(command, manager);
      const items = this.toItems(loaded);
      const plan = planBulk(items, action, context);
      if (dryRun) return toResult(plan);

      const written = await this.writePlan(plan, items, manager);
      await accounts.apply(plan.balanceDeltas);
      changed.push(...(await accounts.saveChanged()), ...written.aggregates);

      const undoToken =
        action.kind === 'delete' || written.undoRows.length === 0
          ? undefined
          : signBulkUndoToken(
              { userId, rows: written.undoRows },
              bulkUndoKey(this.configService),
              new Date(),
            );
      return { ...toResult(plan), undoToken };
    });
  }

  /** Встроенная категория — по slug-id, своя — по UUID; чужая и выдуманная — `null`, план откажет. */
  private async resolveTargetCategory(
    command: BulkUpdateTransactionsCommand,
  ): Promise<BulkContext['targetCategory']> {
    const { action, userId } = command;
    if (action.kind !== 'category') return undefined;

    const builtin = getDefaultCategoryById(action.categoryId);
    if (builtin) return { id: builtin.id, type: builtin.type };
    // У встроенных id не UUID, а колонка категорий — uuid: произвольная строка уронила бы запрос.
    if (!isUUID(action.categoryId)) return null;

    const category = await this.categoryRepository.findById(action.categoryId);
    return category?.userId === userId ? { id: category.id, type: category.typeValue } : null;
  }

  private async loadSelection(
    command: BulkUpdateTransactionsCommand,
    manager: EntityManager,
  ): Promise<BulkSelectionResult> {
    const { selection, userId, dryRun } = command;
    const lock = !dryRun;

    if (selection.kind === 'filter') {
      const loaded = await this.transactionRepository.findForBulk(
        userId,
        {
          kind: 'filter',
          filter: { ...selection.filter, asOf: selection.asOf },
          maxRows: MAX_BULK_ROWS,
        },
        manager,
        { lock },
      );
      if (loaded.overLimit) {
        throw new BadRequestException(
          `Под фильтр подходит больше ${MAX_BULK_ROWS} операций. Сузьте фильтр: например, выберите период или категорию.`,
        );
      }
      assertExpectedCount(selection, loaded.selected);
      return loaded;
    }

    if (selection.ids.length > MAX_BULK_ROWS) {
      throw new BadRequestException(
        `Выбрано больше ${MAX_BULK_ROWS} операций. Снимите часть отметок или сузьте фильтр.`,
      );
    }
    const loaded = await this.transactionRepository.findForBulk(
      userId,
      { kind: 'ids', ids: selection.ids },
      manager,
      { lock },
    );
    if (loaded.foreignIds.length > 0) {
      throw new ForbiddenException('Transaction does not belong to user');
    }
    if (loaded.missingIds.length > 0) {
      throw new ConflictException('Некоторые операции уже удалены. Обновите список.');
    }
    return loaded;
  }

  /** Позиции ленты: строка или обе половины пары оплаты; выбранные id помнятся отдельно. */
  private toItems(loaded: BulkSelectionResult): BulkItem[] {
    const selectedIds = new Set(loaded.selected.map((row) => row.transaction.id));
    const groups = new Map<string, BulkRow[]>();
    for (const row of [...loaded.selected, ...loaded.siblings]) {
      const groupId = row.transaction.paymentGroupId;
      if (groupId !== null) groups.set(groupId, [...(groups.get(groupId) ?? []), row]);
    }

    const placed = new Set<string>();
    const items: BulkItem[] = [];
    for (const row of loaded.selected) {
      if (placed.has(row.transaction.id)) continue;
      const groupId = row.transaction.paymentGroupId;
      const rows = (groupId !== null ? groups.get(groupId) : undefined) ?? [row];
      const ordered = [...rows].sort((a, b) => (a.transaction.id < b.transaction.id ? -1 : 1));
      for (const member of ordered) placed.add(member.transaction.id);

      items.push({
        rows: ordered.map((member) => member.transaction),
        selectedIds: ordered
          .map((member) => member.transaction.id)
          .filter((id) => selectedIds.has(id)),
        locked: ordered.some((member) => member.locked),
      });
    }
    return items;
  }

  /** Записывает план через агрегаты и репозиторий; остатки счетов правит вызывающий. */
  private async writePlan(
    plan: BulkPlan,
    items: BulkItem[],
    manager: EntityManager,
  ): Promise<{ undoRows: BulkUndoRow[]; aggregates: AggregateRoot[] }> {
    const byId = new Map<string, Transaction>(
      items.flatMap((item) => item.rows.map((row) => [row.id, row] as const)),
    );
    const undoRows: BulkUndoRow[] = [];
    const updated: Transaction[] = [];
    const deleted: Transaction[] = [];

    for (const write of plan.writes) {
      const transaction = byId.get(write.id)!;
      if (write.kind === 'delete') {
        transaction.markDeleted();
        deleted.push(transaction);
        continue;
      }

      const before = snapshotRow(transaction);
      if (write.kind === 'toTransfer') {
        // Из пары строка выходит до правки: агрегат не даёт части пары стать переводом.
        transaction.leavePaymentGroup();
        transaction.update({
          type: 'transfer',
          categoryId: TRANSFER_CATEGORY_ID,
          isDebtRelated: false,
          toAccountId: write.toAccountId,
          toAmount: write.toAmount,
          toCurrency: write.toCurrency,
        });
      } else {
        transaction.update(write.changes);
      }
      undoRows.push({ id: transaction.id, before, after: snapshotRow(transaction) });
      updated.push(transaction);
    }

    await this.transactionRepository.saveMany(updated, manager);
    await this.transactionRepository.deleteMany(
      deleted.map((transaction) => transaction.id),
      manager,
    );
    return { undoRows, aggregates: [...updated, ...deleted] };
  }
}

function toResult(plan: BulkPlan): BulkUpdateResult {
  return { changed: plan.changed, skipped: plan.skipped, balanceDeltas: plan.balanceDeltas };
}

/** Число строк, которые правка тронула бы, должно совпасть с тем, что пользователь видел в итоге. */
function assertExpectedCount(
  selection: Extract<BulkSelectionInput, { kind: 'filter' }>,
  selected: BulkRow[],
): void {
  const eligible = selected.filter((row) => !row.locked).length;
  if (eligible !== selection.expectedCount) {
    throw new ConflictException('Список изменился. Обновили итог — проверьте и повторите.');
  }
}
