import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { Debt } from '../../domain/aggregates/debt';
import { DeleteTransactionCommand } from '../../../accounting/application/commands/delete-transaction/delete-transaction.command';
import { reverseSettlement, type ReversalDeps } from './settlement-reversal';

interface SettlementRow {
  settlement_id: string;
  shared: boolean;
}

/** Расчёты долга от нового к старому; `shared` — в расчёте есть записи других долгов. */
async function settlementsOf(manager: EntityManager, debtId: string): Promise<SettlementRow[]> {
  return manager.query<SettlementRow[]>(
    `SELECT settlement_id, BOOL_OR(debt_id IS NOT NULL AND debt_id <> $1) AS shared
     FROM transactions
     WHERE settlement_id IN (
       SELECT settlement_id FROM transactions WHERE debt_id = $1 AND settlement_id IS NOT NULL
     )
     GROUP BY settlement_id
     ORDER BY MAX(created_at) DESC, settlement_id DESC`,
    [debtId],
  );
}

async function recordsOfSettlements(
  manager: EntityManager,
  settlementIds: string[],
): Promise<string[]> {
  if (settlementIds.length === 0) return [];
  const rows = await manager.query<{ id: string }[]>(
    `SELECT id FROM transactions WHERE settlement_id = ANY($1::uuid[])
     ORDER BY created_at ASC, id ASC`,
    [settlementIds],
  );
  return rows.map((row) => row.id);
}

/** Исходная запись чека общая для долгов разделения: уходит только вместе с последним из них. */
async function ownsSourceTransaction(manager: EntityManager, debt: Debt): Promise<boolean> {
  if (!debt.sourceTransactionId) return false;
  const [{ exists }] = await manager.query<{ exists: boolean }[]>(
    'SELECT EXISTS(SELECT 1 FROM debts WHERE source_transaction_id = $1 AND id <> $2) AS exists',
    [debt.sourceTransactionId, debt.id],
  );
  return !exists;
}

/** Всё, что осталось от долга после расчётов: свои записи, выдача, закрытие, чек, комиссия. */
async function remainingRecords(manager: EntityManager, debt: Debt): Promise<string[]> {
  const linked = [debt.transactionId, debt.closeTransactionId, debt.feeTransactionId];
  if (await ownsSourceTransaction(manager, debt)) linked.push(debt.sourceTransactionId);

  // Один запрос заодно убирает дубли и уже удалённые записи.
  const rows = await manager.query<{ id: string }[]>(
    `SELECT id FROM transactions WHERE debt_id = $1 OR id = ANY($2::uuid[])
     ORDER BY created_at ASC, id ASC`,
    [debt.id, linked.filter((id): id is string => !!id)],
  );
  return rows.map((row) => row.id);
}

/**
 * Удаляет долг со всеми записями одной транзакцией БД. Расчёты, затронувшие и
 * другие долги, отменяются штатно — с проверкой порядка по этим долгам.
 */
export async function removeDebtWithRecords(
  deps: ReversalDeps,
  userId: string,
  debtId: string,
): Promise<void> {
  await deps.dataSource.transaction(async (manager) => {
    const debt = await deps.debtRepository.findById(debtId, manager);
    if (!debt) throw new NotFoundException('Debt not found');
    if (debt.userId !== userId) throw new ForbiddenException('Access denied');

    const deleteAll = async (ids: string[]) => {
      for (const id of ids) {
        await deps.commandBus.execute(new DeleteTransactionCommand(id, userId, true, manager));
      }
    };

    const settlements = await settlementsOf(manager, debtId);
    // Свои расчёты (платёж, переплата) уходят первыми: они новее зачёта и блокировали
    // бы его отмену, хотя долг всё равно исчезает.
    await deleteAll(
      await recordsOfSettlements(
        manager,
        settlements.filter((s) => !s.shared).map((s) => s.settlement_id),
      ),
    );
    // Общие расчёты — от нового к старому: иначе более поздний заблокирует более ранний.
    for (const { settlement_id } of settlements.filter((s) => s.shared)) {
      await reverseSettlement(deps, userId, settlement_id, manager);
    }

    await deleteAll(await remainingRecords(manager, debt));
    await deps.debtRepository.delete(debtId, manager);
  });
}
