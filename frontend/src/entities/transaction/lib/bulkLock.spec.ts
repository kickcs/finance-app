import { describe, it, expect } from 'vitest';
import type { Transaction } from '../model/types';
import { bulkLockHint } from './bulkLock';

const tx = (fields: Partial<Transaction>) =>
  ({ type: 'expense', is_informational: false, ...fields }) as Transaction;

describe('bulkLockHint', () => {
  it('у каждой причины замка своя подсказка', () => {
    expect(bulkLockHint(tx({ debt_id: 'd-1' }))).toBe(
      'связана с долгом, правится в карточке долга',
    );
    expect(bulkLockHint(tx({ type: 'adjustment' }))).toBe(
      'корректировка баланса, правится по одной',
    );
    expect(bulkLockHint(tx({ type: 'income', is_informational: true }))).toBe(
      'информационная запись, не правится',
    );
  });
});
