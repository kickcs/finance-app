import { describe, it, expect } from 'vitest';
import { getFrequentCategories } from './useFrequentCategories';
import type { Category } from './types';
import type { Transaction } from '@/shared/api/database.types';

function makeTx(categoryId: string): Transaction {
  return {
    id: `tx-${Math.random()}`,
    user_id: 'user-1',
    account_id: 'acc-1',
    category_id: categoryId,
    amount: 1000,
    currency: 'UZS',
    type: 'expense',
    description: null,
    date: '2025-01-01T00:00:00.000Z',
    created_at: '2025-01-01T00:00:00.000Z',
    is_debt_related: false,
    is_informational: false,
    debt_id: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    returned_amount: 0,
    net_amount: 1000,
    has_debt_returns: false,
  };
}

function makeCat(id: string, isFrequent?: boolean): Category {
  return { id, name: id, icon: 'restaurant', color: '#f00', type: 'expense', isFrequent };
}

describe('getFrequentCategories', () => {
  it('ранжирует по частоте употребления в транзакциях', () => {
    const cats = [makeCat('a'), makeCat('b'), makeCat('c')];
    const txs = [makeTx('c'), makeTx('c'), makeTx('c'), makeTx('b'), makeTx('b'), makeTx('a')];
    expect(getFrequentCategories(cats, txs, 8).map((c) => c.id)).toEqual(['c', 'b', 'a']);
  });

  it('обрезает до topN', () => {
    const cats = ['a', 'b', 'c'].map((id) => makeCat(id));
    const txs = [makeTx('a'), makeTx('b'), makeTx('c'), makeTx('c'), makeTx('a')];
    expect(getFrequentCategories(cats, txs, 2)).toHaveLength(2);
  });

  it('fallback на isFrequent при < 5 транзакций', () => {
    const cats = [makeCat('a', false), makeCat('b'), makeCat('c', true)];
    const txs = [makeTx('a'), makeTx('a'), makeTx('a'), makeTx('a')]; // 4 шт
    // isFrequent !== false → 'b' и 'c' в порядке исходного массива
    expect(getFrequentCategories(cats, txs, 8).map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('fallback при undefined transactions', () => {
    const cats = [makeCat('a'), makeCat('b', false)];
    expect(getFrequentCategories(cats, undefined, 8).map((c) => c.id)).toEqual(['a']);
  });

  it('добирает до topN: сначала isFrequent, потом остальные в порядке БД', () => {
    const cats = [makeCat('a', false), makeCat('b'), makeCat('c'), makeCat('used')];
    const txs = Array.from({ length: 5 }, () => makeTx('used'));
    // used — по статистике; добор: b, c (isFrequent!==false), затем a
    expect(getFrequentCategories(cats, txs, 4).map((c) => c.id)).toEqual(['used', 'b', 'c', 'a']);
  });

  it('игнорирует category_id, которых нет в переданном списке категорий', () => {
    const cats = [makeCat('a')];
    const txs = Array.from({ length: 5 }, () => makeTx('other-type-cat'));
    expect(getFrequentCategories(cats, txs, 8).map((c) => c.id)).toEqual(['a']);
  });

  it('порог считается по релевантным транзакциям, а не по всему окну', () => {
    const cats = [makeCat('a', false), makeCat('b'), makeCat('c', true)];
    // 20 транзакций в окне, но только 2 относятся к переданным категориям →
    // статистики недостаточно, работает isFrequent-fallback
    const txs = [
      ...Array.from({ length: 18 }, () => makeTx('transfer-cat')),
      makeTx('a'),
      makeTx('a'),
    ];
    expect(getFrequentCategories(cats, txs, 8).map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('fallback на все категории, если пользователь выключил isFrequent у всех', () => {
    const cats = [makeCat('a', false), makeCat('b', false), makeCat('c', false)];
    expect(getFrequentCategories(cats, undefined, 2).map((c) => c.id)).toEqual(['a', 'b']);
  });
});
