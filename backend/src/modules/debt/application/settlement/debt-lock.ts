import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { Debt } from '../../domain/aggregates/debt';
import type { IDebtRepository } from '../../domain/repositories';

/** Долги под замком, уже свежие. Чужих и несуществующих id здесь нет. */
export type LockedDebts = ReadonlyMap<string, Debt>;

/**
 * Блокирует строки долгов до конца транзакции и сразу читает их: второе чтение не нужно.
 * Порядок по id один для всех расчётов: общие долги берутся в одной очередности и не ждут друг друга по кругу.
 */
export async function lockDebts(
  debtRepository: IDebtRepository,
  manager: EntityManager,
  userId: string,
  debtIds: readonly string[],
): Promise<LockedDebts> {
  const ids = [...new Set(debtIds)];
  const debts = await debtRepository.findByIdsForUpdate(ids, userId, manager);
  return new Map(debts.map((debt) => [debt.id, debt]));
}

/**
 * Свой долг: из `known` (прочитанные заранее), а когда его там нет — прямым чтением. Так 404 и 403
 * различаются, хотя замок берёт только долги пользователя.
 */
export async function loadOwnedDebt(
  debtRepository: IDebtRepository,
  userId: string,
  debtId: string,
  source: { manager?: EntityManager; known?: ReadonlyMap<string, Debt>; forbidden?: string } = {},
): Promise<Debt> {
  const debt = source.known?.get(debtId) ?? (await debtRepository.findById(debtId, source.manager));
  if (!debt) throw new NotFoundException('Debt not found');
  if (debt.userId !== userId) throw new ForbiddenException(source.forbidden ?? 'Access denied');
  return debt;
}
