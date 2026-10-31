import type { Transaction } from '../model/types';

/**
 * Почему строка вне массовой правки — для подсказки у самой строки. Замок ставит сервер
 * (`bulk_locked`); здесь только причина, сам предикат клиент не повторяет.
 */
export function bulkLockHint(tx: Pick<Transaction, 'type' | 'is_informational'>): string {
  if (tx.is_informational) return 'информационная запись, не правится';
  if (tx.type === 'adjustment') return 'корректировка баланса, правится по одной';
  return 'связана с долгом, правится в карточке долга';
}
