import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import type { Debt } from '@/shared/api/database.types';

/** Остатки в разных валютах не складываются — «Закрыть все» принимает такие долги только целиком. */
export function hasMixedCurrencies(debts: Debt[]): boolean {
  return new Set(debts.map((d) => d.currency || DEFAULT_CURRENCY)).size > 1;
}

/**
 * Можно ли предлагать «Закрыть все» до всякого запроса. Встречные долги сводятся
 * зачётом, а он возможен только в одной валюте; остальное решает сервер.
 */
export function canCloseAllTogether(debts: Debt[]): boolean {
  const hasBothDirections =
    debts.some((d) => d.debt_type === 'given') && debts.some((d) => d.debt_type === 'taken');
  return !hasBothDirections || !hasMixedCurrencies(debts);
}
