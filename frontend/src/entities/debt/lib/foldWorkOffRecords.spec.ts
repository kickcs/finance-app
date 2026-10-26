import { describe, it, expect } from 'vitest';
import { foldWorkOffRecords } from './foldWorkOffRecords';
import type { Transaction } from '@/shared/api/database.types';

const DATE = '2026-09-01T10:00:00.000Z';

function tx(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    user_id: 'user-1',
    account_id: 'acc-1',
    category_id: 'debt_return_to_me',
    amount: 100,
    currency: 'UZS',
    type: 'income',
    description: null,
    date: DATE,
    created_at: DATE,
    is_debt_related: true,
    is_informational: false,
    debt_id: 'debt-1',
    settlement_id: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    ...overrides,
  } as Transaction;
}

describe('foldWorkOffRecords', () => {
  it('выбрасывает запись создания долга', () => {
    const records = foldWorkOffRecords([tx({ id: 'creation' }), tx({ id: 'pay' })], 'creation');

    expect(records.map((r) => r.transaction.id)).toEqual(['pay']);
    expect(records[0].byWork).toBe(false);
  });

  it('отметку отработки без категории показывает работой', () => {
    const records = foldWorkOffRecords(
      [tx({ id: 'marker', category_id: 'debt_worked_off', is_informational: true })],
      null,
    );

    expect(records).toHaveLength(1);
    expect(records[0].byWork).toBe(true);
  });

  it('прощение остаётся своим узлом ленты и сюда не попадает', () => {
    const records = foldWorkOffRecords(
      [tx({ id: 'forgiven', category_id: 'debt_forgiven', is_informational: true })],
      null,
    );

    expect(records).toHaveLength(0);
  });

  // Пара «трата по категории + возврат» — одно событие: возврат прячется за
  // тратой, иначе в ленте два узла на одну отработку.
  it('пару отработки одного расчёта сворачивает в один узел работы', () => {
    const records = foldWorkOffRecords(
      [
        tx({
          id: 'work',
          category_id: 'repair',
          type: 'expense',
          is_debt_related: false,
          settlement_id: 's-1',
        }),
        tx({ id: 'return', settlement_id: 's-1' }),
      ],
      null,
    );

    expect(records).toHaveLength(1);
    expect(records[0].transaction.id).toBe('work');
    expect(records[0].byWork).toBe(true);
  });

  it('платёж деньгами другого расчёта пару не задевает', () => {
    const otherDate = '2026-09-05T10:00:00.000Z';
    const records = foldWorkOffRecords(
      [
        tx({
          id: 'work',
          category_id: 'repair',
          type: 'expense',
          is_debt_related: false,
          settlement_id: 's-1',
        }),
        tx({ id: 'return', settlement_id: 's-1' }),
        tx({ id: 'money', date: otherDate, created_at: otherDate, settlement_id: 's-2' }),
      ],
      null,
    );

    expect(records.map((r) => r.transaction.id)).toEqual(['work', 'money']);
    expect(records.map((r) => r.byWork)).toEqual([true, false]);
  });

  // Прежнее правило сводило по совпадению даты и прятало чужой платёж.
  it('платёж деньгами той же даты, но другого расчёта остаётся отдельной строкой', () => {
    const records = foldWorkOffRecords(
      [
        tx({
          id: 'work',
          category_id: 'repair',
          type: 'expense',
          is_debt_related: false,
          settlement_id: 's-1',
        }),
        tx({ id: 'return', settlement_id: 's-1' }),
        tx({ id: 'money', settlement_id: 's-2' }),
      ],
      null,
    );

    expect(records.map((r) => r.transaction.id).sort()).toEqual(['money', 'work']);
    expect(records.find((r) => r.transaction.id === 'money')?.byWork).toBe(false);
  });

  it('два платежа одной даты в разных расчётах дают две строки', () => {
    const records = foldWorkOffRecords(
      [tx({ id: 'pay-1', settlement_id: 's-1' }), tx({ id: 'pay-2', settlement_id: 's-2' })],
      null,
    );

    expect(records.map((r) => r.transaction.id).sort()).toEqual(['pay-1', 'pay-2']);
  });

  it('запись без debt_id (переплата) в ленту долга не попадает', () => {
    const records = foldWorkOffRecords(
      [
        tx({ id: 'pay', settlement_id: 's-1' }),
        tx({
          id: 'excess',
          debt_id: null,
          category_id: 'salary',
          is_debt_related: false,
          settlement_id: 's-1',
        }),
      ],
      null,
    );

    expect(records.map((r) => r.transaction.id)).toEqual(['pay']);
  });

  it('сортирует по дате события', () => {
    const older = '2026-08-01T10:00:00.000Z';
    const records = foldWorkOffRecords(
      [tx({ id: 'new' }), tx({ id: 'old', date: older, created_at: older })],
      null,
    );

    expect(records.map((r) => r.transaction.id)).toEqual(['old', 'new']);
  });
});
