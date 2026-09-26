import { describe, it, expect } from 'vitest';
import { findClosingRecords, debtHasClosingRecords } from './findClosingRecords';
import type { Transaction } from '@/shared/api/database.types';
import { makeDebt } from '@/test/fixtures/debt';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    category_id: 'debt_return_to_me',
    is_informational: false,
    ...overrides,
  } as Transaction;
}

describe('findClosingRecords', () => {
  it('returns nothing for a debt that was never closed', () => {
    expect(findClosingRecords(makeDebt(), [makeTx()])).toEqual([]);
    expect(findClosingRecords(null, [makeTx()])).toEqual([]);
  });

  it('finds the transaction the debt points at', () => {
    const debt = makeDebt({ close_transaction_id: 'tx-close' });
    const close = makeTx({ id: 'tx-close' });

    expect(findClosingRecords(debt, [makeTx({ id: 'tx-other' }), close])).toEqual([close]);
  });

  // Сервер удаляет и платёж, и запись прощения — «оплатил часть, остальное
  // простил» оставляет две записи, а close_transaction_id указывает на платёж.
  it('also finds the forgiveness record the debt does not point at', () => {
    const debt = makeDebt({ close_transaction_id: 'tx-pay', forgiven_amount: 700 });
    const pay = makeTx({ id: 'tx-pay' });
    const forgiven = makeTx({
      id: 'tx-forgiven',
      category_id: 'debt_forgiven',
      is_informational: true,
    });

    expect(findClosingRecords(debt, [pay, forgiven])).toEqual([pay, forgiven]);
  });

  // Закрытие отработкой с категорией — пара записей на ноль по балансу с одной
  // отметкой времени. Сервер снимает обе, значит в списке должны быть обе.
  it('also finds the work leg paired with the closing return', () => {
    const date = '2026-09-01T10:00:00.000Z';
    const debt = makeDebt({ close_transaction_id: 'tx-return' });
    const back = makeTx({ id: 'tx-return', date });
    const work = makeTx({ id: 'tx-work', category_id: 'repair', date });
    const other = makeTx({
      id: 'tx-other',
      category_id: 'repair',
      date: '2026-08-01T10:00:00.000Z',
    });

    expect(findClosingRecords(debt, [back, work, other])).toEqual([back, work]);
  });
});

describe('debtHasClosingRecords', () => {
  it('reports what the debt itself knows, without the transactions list', () => {
    expect(debtHasClosingRecords(null)).toBe(false);
    expect(debtHasClosingRecords(makeDebt())).toBe(false);
    expect(debtHasClosingRecords(makeDebt({ close_transaction_id: 'tx-close' }))).toBe(true);
    expect(debtHasClosingRecords(makeDebt({ forgiven_amount: 700 }))).toBe(true);
  });
});
