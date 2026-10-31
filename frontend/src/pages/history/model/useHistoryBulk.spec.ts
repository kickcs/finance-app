import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import type { Category } from '@/entities/category';
import type { Transaction, TransactionFilters } from '@/entities/transaction';
import { useHistoryBulk } from './useHistoryBulk';

const categories = [
  { id: 'taxi', type: 'expense' },
  { id: 'salary', type: 'income' },
] as Category[];

const row = (type: string, category_id: string) => ({ type, category_id }) as Transaction;

function setup(mode: 'all' | 'manual', filters: TransactionFilters, rows: Transaction[] = []) {
  return useHistoryBulk({
    mode: ref(mode),
    filters: () => filters,
    selectedRows: () => rows,
    categories: () => categories,
  });
}

describe('useHistoryBulk', () => {
  it('«Изменить все»: типы из вкладки, иначе из категорий фильтра', () => {
    expect(setup('all', { type: 'income' }).categoryTypes.value).toEqual(['income']);
    expect(setup('all', { category_ids: ['taxi', 'salary'] }).categoryTypes.value).toEqual([
      'expense',
      'income',
    ]);
    expect(setup('all', {}).categoryTypes.value).toEqual(['expense', 'income']);
    expect(setup('all', { category_ids: ['taxi'] }).sourceCategoryIds.value).toEqual(['taxi']);
  });

  it('ручной выбор: типы и исходные категории — по отмеченным строкам', () => {
    const rows = [row('expense', 'taxi'), row('expense', 'taxi')];
    const bulk = setup('manual', { type: 'income' }, rows);
    expect(bulk.categoryTypes.value).toEqual(['expense']);
    expect(bulk.sourceCategoryIds.value).toEqual(['taxi']);
  });

  it('переводы и долги в выборке не дают групп — предлагаются расходы', () => {
    expect(setup('manual', {}, [row('transfer', 'transfer')]).categoryTypes.value).toEqual([
      'expense',
    ]);
  });
});
