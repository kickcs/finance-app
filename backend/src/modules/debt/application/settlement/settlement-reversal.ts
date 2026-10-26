import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { Debt } from '../../domain/aggregates/debt';
import { runInTransaction } from '../../../../shared/infrastructure/run-in-transaction';
import { DeleteTransactionCommand } from '../../../accounting/application/commands/delete-transaction/delete-transaction.command';
import { DEBT_CATEGORY_IDS } from '../../../accounting/domain/constants/default-categories';
import { loadOwnedDebt, lockDebts } from './debt-lock';
import type { SettlementDeps } from './settlement-deps';
import { displayName, round2 } from './settlement-plan';

export interface SettlementRecord {
  id: string;
  userId: string;
  debtId: string | null;
  categoryId: string;
  amount: number;
}

/** Категории, уменьшающие остаток долга. Нога работы (`debt_id` + недолговая категория) не входит: её пара, возврат, уже несёт сумму. */
const APPLIED_CATEGORY_IDS: string[] = [
  DEBT_CATEGORY_IDS.RETURN_TO_ME,
  DEBT_CATEGORY_IDS.RETURN_FROM_ME,
  DEBT_CATEGORY_IDS.OFFSET,
  DEBT_CATEGORY_IDS.WORKED_OFF,
];

/** Сколько расчёт погасил и простил по долгу — ровно то, что нужно вернуть в остаток. */
export function revertAmounts(
  records: readonly SettlementRecord[],
  debtId: string,
): { applied: number; forgiven: number } {
  let applied = 0;
  let forgiven = 0;
  for (const record of records) {
    if (record.debtId !== debtId) continue;
    if (APPLIED_CATEGORY_IDS.includes(record.categoryId)) applied += record.amount;
    else if (record.categoryId === DEBT_CATEGORY_IDS.FORGIVEN) forgiven += record.amount;
  }
  return { applied: round2(applied), forgiven: round2(forgiven) };
}

interface RecordRow {
  id: string;
  user_id: string;
  debt_id: string | null;
  category_id: string;
  amount: string;
}

/** Долги расчёта по его записям — чтение без блокировки, только чтобы знать, что запирать. */
async function debtIdsOf(manager: EntityManager, settlementId: string): Promise<string[]> {
  const rows = await manager.query<{ debt_id: string }[]>(
    'SELECT DISTINCT debt_id FROM transactions WHERE settlement_id = $1 AND debt_id IS NOT NULL',
    [settlementId],
  );
  return rows.map((row) => row.debt_id);
}

async function loadRecords(
  manager: EntityManager,
  settlementId: string,
): Promise<SettlementRecord[]> {
  // FOR UPDATE: параллельная отмена того же расчёта дождётся и не найдёт записей — 404, а не двойной возврат остатка.
  const rows = await manager.query<RecordRow[]>(
    `SELECT id, user_id, debt_id, category_id, amount FROM transactions
     WHERE settlement_id = $1 ORDER BY created_at ASC, id ASC FOR UPDATE`,
    [settlementId],
  );
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    debtId: row.debt_id,
    categoryId: row.category_id,
    amount: Number(row.amount),
  }));
}

/** Отменить можно только последний расчёт долга: иначе остаток считался бы от несуществующего. */
async function assertLatestSettlement(
  manager: EntityManager,
  settlementId: string,
  debts: readonly Debt[],
): Promise<void> {
  if (debts.length === 0) return;

  const later = await manager.query<{ debt_id: string }[]>(
    `SELECT DISTINCT debt_id FROM transactions
     WHERE debt_id = ANY($1::uuid[]) AND settlement_id IS NOT NULL AND settlement_id <> $2
       AND created_at > (SELECT MAX(created_at) FROM transactions WHERE settlement_id = $2)`,
    [debts.map((debt) => debt.id), settlementId],
  );
  const blocked = new Set(later.map((row) => row.debt_id));
  const first = debts.find((debt) => blocked.has(debt.id));
  if (first) {
    throw new ConflictException(
      `Сначала отмените более поздний расчёт по долгу «${displayName(first)}»`,
    );
  }
}

/** Снимает записи по одной, без проверок долга: остатки правит вызывающий. */
export async function deleteRecords(
  deps: Pick<SettlementDeps, 'commandBus'>,
  userId: string,
  recordIds: readonly string[],
  manager: EntityManager,
): Promise<void> {
  for (const id of recordIds) {
    await deps.commandBus.execute(new DeleteTransactionCommand(id, userId, true, manager));
  }
}

/**
 * Отменяет расчёт целиком одной транзакцией БД: возвращает остатки затронутых
 * долгов и удаляет все записи расчёта со снятием их влияния на счета.
 */
export function reverseSettlement(
  deps: SettlementDeps,
  userId: string,
  settlementId: string,
  outerManager?: EntityManager,
): Promise<Debt[]> {
  return runInTransaction(deps.dataSource, outerManager, async (manager) => {
    // Сначала долги, потом записи: так же берут замки платёж и удаление долга, иначе они ждали бы друг друга по кругу.
    const locked = await lockDebts(
      deps.debtRepository,
      manager,
      userId,
      await debtIdsOf(manager, settlementId),
    );
    const records = await loadRecords(manager, settlementId);
    if (records.length === 0) throw new NotFoundException('Расчёт не найден');
    if (records.some((record) => record.userId !== userId)) {
      throw new ForbiddenException('Расчёт принадлежит другому пользователю');
    }

    // Долг, которого нет под замком, уже удалён: возвращать остаток некому.
    const debtIds = new Set(records.map((r) => r.debtId).filter((id): id is string => id !== null));
    const debts = [...debtIds].flatMap((id) => locked.get(id) ?? []);
    await assertLatestSettlement(manager, settlementId, debts);

    // Долги сохраняются раньше записей: `close_transaction_id` не должен ни на миг указывать на удалённую запись.
    const reverted: Debt[] = [];
    for (const debt of debts) {
      const { applied, forgiven } = revertAmounts(records, debt.id);
      debt.revertSettlement(applied, forgiven);
      reverted.push(await deps.debtRepository.save(debt, manager));
    }

    await deleteRecords(
      deps,
      userId,
      records.map((record) => record.id),
      manager,
    );
    return reverted;
  });
}

/**
 * Отмена закрытия: отменяется расчёт, закрывший долг. Закрытие без расчёта
 * (старый патч без записи) просто открывает долг с остатком по уцелевшим записям.
 */
export async function reopenClosedDebt(
  deps: SettlementDeps,
  userId: string,
  debtId: string,
): Promise<Debt> {
  return deps.dataSource.transaction(async (manager) => {
    const debt = await loadOwnedDebt(deps.debtRepository, userId, debtId, { manager });
    if (!debt.isClosed) throw new ConflictException('Debt is not closed');

    const settlementId = debt.closeTransactionId
      ? await settlementOf(manager, debt.closeTransactionId)
      : null;
    if (settlementId) {
      // Долги расчёта отмена запирает сама и считает по свежим данным.
      const reverted = await reverseSettlement(deps, userId, settlementId, manager);
      return reverted.find((d) => d.id === debtId) ?? debt;
    }

    const known = await lockDebts(deps.debtRepository, manager, userId, [debtId]);
    const current = await loadOwnedDebt(deps.debtRepository, userId, debtId, { manager, known });
    // Пока ждали замок, долг могли открыть: затирать его остаток нельзя.
    if (!current.isClosed) throw new ConflictException('Debt is not closed');

    const [row] = await manager.query<{ applied: string }[]>(
      `SELECT COALESCE(SUM(amount), 0) AS applied FROM transactions
       WHERE debt_id = $1 AND category_id = ANY($2::text[])`,
      [debtId, APPLIED_CATEGORY_IDS],
    );
    const remaining = round2(current.totalAmountValue - Number(row.applied));
    // Возвраты покрыли весь долг: открывать нечего, а нулевой остаток у открытого долга не бывает.
    if (remaining <= 0) {
      throw new ConflictException(
        'Долг погашен платежами полностью — отмените последний платёж в истории',
      );
    }
    current.reopenWithRemaining(remaining);
    return deps.debtRepository.save(current, manager);
  });
}

async function settlementOf(manager: EntityManager, transactionId: string): Promise<string | null> {
  const rows = await manager.query<{ settlement_id: string | null }[]>(
    'SELECT settlement_id FROM transactions WHERE id = $1',
    [transactionId],
  );
  return rows[0]?.settlement_id ?? null;
}
