import type { Transaction } from '@/shared/api/database.types';

/**
 * Долговая запись вне расчёта (выдача, комиссия): править и удалять её можно только из «Долгов».
 * Корректировка использует `is_debt_related` как флаг направления, а запись расчёта сервер
 * правит и снимает сам — обе не в счёт.
 */
export function isDebtRecordOutsideSettlement(
  tx: Pick<Transaction, 'is_debt_related' | 'type' | 'settlement_id'>,
): boolean {
  return tx.is_debt_related && tx.type !== 'adjustment' && !tx.settlement_id;
}
