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
  it('пару с категорией сворачивает в один узел работы', () => {
    const records = foldWorkOffRecords(
      [
        tx({ id: 'work', category_id: 'repair', type: 'expense', is_debt_related: false }),
        tx({ id: 'return' }),
      ],
      null,
    );

    expect(records).toHaveLength(1);
    expect(records[0].transaction.id).toBe('work');
    expect(records[0].byWork).toBe(true);
  });

  it('платёж деньгами другой даты пару не задевает', () => {
    const otherDate = '2026-09-05T10:00:00.000Z';
    const records = foldWorkOffRecords(
      [
        tx({ id: 'work', category_id: 'repair', type: 'expense', is_debt_related: false }),
        tx({ id: 'return' }),
        tx({ id: 'money', date: otherDate, created_at: otherDate }),
      ],
      null,
    );

    expect(records.map((r) => r.transaction.id)).toEqual(['work', 'money']);
    expect(records.map((r) => r.byWork)).toEqual([true, false]);
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
