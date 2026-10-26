import { describe, it, expect } from 'vitest';
import { findClosingRecords, debtHasClosingRecords } from './findClosingRecords';
import type { Transaction } from '@/shared/api/database.types';
import { makeDebt } from '@/test/fixtures/debt';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    category_id: 'debt_return_to_me',
    is_informational: false,
    debt_id: 'debt-1',
    settlement_id: null,
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

  // Сервер снимает расчёт целиком: «оплатил часть, остальное простил» с переплатой
  // оставляет три записи, а close_transaction_id указывает только на платёж.
  it('finds every record of the settlement the closing payment belongs to', () => {
    const debt = makeDebt({ close_transaction_id: 'tx-pay', forgiven_amount: 700 });
    const pay = makeTx({ id: 'tx-pay', settlement_id: 's-1' });
    const excess = makeTx({
      id: 'tx-excess',
      category_id: 'salary',
      debt_id: null,
      settlement_id: 's-1',
    });
    const forgiven = makeTx({
      id: 'tx-forgiven',
      category_id: 'debt_forgiven',
      is_informational: true,
      settlement_id: 's-1',
    });

    expect(findClosingRecords(debt, [pay, excess, forgiven])).toEqual([pay, excess, forgiven]);
  });

  // Закрытие отработкой с категорией — пара записей на ноль по балансу в одном
  // расчёте. Сервер снимает обе, значит в списке должны быть обе.
  it('also finds the work leg paired with the closing return', () => {
    const debt = makeDebt({ close_transaction_id: 'tx-return' });
    const back = makeTx({ id: 'tx-return', settlement_id: 's-1' });
    const work = makeTx({ id: 'tx-work', category_id: 'repair', settlement_id: 's-1' });

    expect(findClosingRecords(debt, [back, work])).toEqual([back, work]);
  });

  it('leaves out records of other settlements, even on the same date', () => {
    const date = '2026-09-01T10:00:00.000Z';
    const debt = makeDebt({ close_transaction_id: 'tx-close' });
    const close = makeTx({ id: 'tx-close', date, settlement_id: 's-2' });
    const earlier = makeTx({ id: 'tx-earlier', date, settlement_id: 's-1' });
    const earlierForgiven = makeTx({
      id: 'tx-old-forgiven',
      category_id: 'debt_forgiven',
      is_informational: true,
      settlement_id: 's-1',
    });

    expect(findClosingRecords(debt, [earlier, earlierForgiven, close])).toEqual([close]);
  });

  // Легаси без связки: даты и категории больше ничего не значат, снимается
  // только сама закрывающая запись.
  it('returns only the closing record when it has no settlement', () => {
    const date = '2026-09-01T10:00:00.000Z';
    const debt = makeDebt({ close_transaction_id: 'tx-pay', forgiven_amount: 700 });
    const pay = makeTx({ id: 'tx-pay', date, settlement_id: null });
    const forgiven = makeTx({
      id: 'tx-forgiven',
      category_id: 'debt_forgiven',
      is_informational: true,
      date,
      settlement_id: null,
    });
    const work = makeTx({ id: 'tx-work', category_id: 'repair', date, settlement_id: null });

    expect(findClosingRecords(debt, [pay, forgiven, work])).toEqual([pay]);
  });

  it('returns nothing while the closing record is not loaded yet', () => {
    const debt = makeDebt({ close_transaction_id: 'tx-close' });

    expect(findClosingRecords(debt, [makeTx({ id: 'tx-other', settlement_id: 's-1' })])).toEqual(
      [],
    );
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
