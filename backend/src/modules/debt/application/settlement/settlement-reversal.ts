import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { CommandBus } from '@nestjs/cqrs';
import type { DataSource, EntityManager } from 'typeorm';
import type { Debt } from '../../domain/aggregates/debt';
import type { IDebtRepository } from '../../domain/repositories';
import { DeleteTransactionCommand } from '../../../accounting/application/commands/delete-transaction/delete-transaction.command';
import { DEBT_CATEGORY_IDS } from '../../../accounting/domain/constants/default-categories';
import { displayName, round2 } from './settlement-plan';

export interface ReversalDeps {
  debtRepository: IDebtRepository;
  commandBus: CommandBus;
  dataSource: DataSource;
}

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
  for (const debt of debts) {
    const later = await manager.query<unknown[]>(
      `SELECT 1 FROM transactions
       WHERE debt_id = $1 AND settlement_id IS NOT NULL AND settlement_id <> $2
         AND created_at > (SELECT MAX(created_at) FROM transactions WHERE settlement_id = $2)
       LIMIT 1`,
      [debt.id, settlementId],
    );
    if (later.length > 0) {
      throw new ConflictException(
        `Сначала отмените более поздний расчёт по долгу «${displayName(debt)}»`,
      );
    }
  }
}

/**
 * Отменяет расчёт целиком одной транзакцией БД: возвращает остатки затронутых
 * долгов и удаляет все записи расчёта со снятием их влияния на счета.
 */
export async function reverseSettlement(
  deps: ReversalDeps,
  userId: string,
  settlementId: string,
  manager?: EntityManager,
): Promise<Debt[]> {
  if (!manager) {
    return deps.dataSource.transaction((inner) =>
      reverseSettlement(deps, userId, settlementId, inner),
    );
  }

  const records = await loadRecords(manager, settlementId);
  if (records.length === 0) throw new NotFoundException('Расчёт не найден');
  if (records.some((record) => record.userId !== userId)) {
    throw new ForbiddenException('Расчёт принадлежит другому пользователю');
  }

  const debtIds = [
    ...new Set(records.map((r) => r.debtId).filter((id): id is string => id !== null)),
  ];
  const debts: Debt[] = [];
  for (const id of debtIds) {
    const debt = await deps.debtRepository.findById(id, manager);
    if (debt) debts.push(debt);
  }
  await assertLatestSettlement(manager, settlementId, debts);

  // Долги сохраняются раньше записей: `close_transaction_id` не должен ни на миг указывать на удалённую запись.
  const reverted: Debt[] = [];
  for (const debt of debts) {
    const { applied, forgiven } = revertAmounts(records, debt.id);
    debt.revertSettlement(applied, forgiven);
    reverted.push(await deps.debtRepository.save(debt, manager));
  }

  for (const record of records) {
    await deps.commandBus.execute(new DeleteTransactionCommand(record.id, userId, true, manager));
  }
  return reverted;
}

/**
 * Отмена закрытия: отменяется расчёт, закрывший долг. Закрытие без расчёта
 * (старый патч без записи) просто открывает долг с остатком по уцелевшим записям.
 */
export async function reopenClosedDebt(
  deps: ReversalDeps,
  userId: string,
  debtId: string,
): Promise<Debt> {
  const debt = await deps.debtRepository.findById(debtId);
  if (!debt) throw new NotFoundException('Debt not found');
  if (debt.userId !== userId) throw new ForbiddenException('Access denied');
  if (!debt.isClosed) throw new ConflictException('Debt is not closed');

  const settlementId = debt.closeTransactionId
    ? await settlementOf(deps.dataSource, debt.closeTransactionId)
    : null;
  if (settlementId) {
    await reverseSettlement(deps, userId, settlementId);
    return (await deps.debtRepository.findById(debtId)) ?? debt;
  }

  return deps.dataSource.transaction(async (manager) => {
    const current = (await deps.debtRepository.findById(debtId, manager)) ?? debt;
    const [row] = await manager.query<{ applied: string }[]>(
      `SELECT COALESCE(SUM(amount), 0) AS applied FROM transactions
       WHERE debt_id = $1 AND category_id = ANY($2::text[])`,
      [debtId, APPLIED_CATEGORY_IDS],
    );
    const total = current.totalAmountValue;
    const remaining = Math.min(total, round2(total - Number(row.applied)));
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

async function settlementOf(dataSource: DataSource, transactionId: string): Promise<string | null> {
  const rows = await dataSource.query<{ settlement_id: string | null }[]>(
    'SELECT settlement_id FROM transactions WHERE id = $1',
    [transactionId],
  );
  return rows[0]?.settlement_id ?? null;
}
