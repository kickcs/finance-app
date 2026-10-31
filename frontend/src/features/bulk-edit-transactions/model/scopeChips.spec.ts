import { describe, it, expect } from 'vitest';
import type { Category } from '@/entities/category';
import { buildScopeChips } from './scopeChips';

const categories: Category[] = [
  { id: 'taxi', name: 'Такси', icon: 'local_taxi', color: '#F59E0B', type: 'expense' },
  { id: 'food', name: 'Еда', icon: 'restaurant', color: '#10B981', type: 'expense' },
];
const accounts = [
  { id: 'a-1', name: 'Uzcard', color: '#4F46E5' },
  { id: 'a-2', name: 'Наличные', color: '#059669' },
];

const base = { filters: {}, categories, accounts };
const OCTOBER = { start_date: '2026-10-01', end_date: '2026-10-31' };

describe('buildScopeChips', () => {
  it('без фильтра чипов нет', () => {
    expect(buildScopeChips(base)).toEqual([]);
  });

  it('держит порядок: поиск, период, тип, категории, теги, счета', () => {
    const chips = buildScopeChips({
      ...base,
      periodLabel: 'Октябрь',
      filters: {
        ...OCTOBER,
        search: 'такси',
        type: 'expense',
        category_ids: ['taxi', 'food'],
        tags: ['работа'],
        account_ids: ['a-1'],
      },
    });
    expect(chips.map((c) => c.label)).toEqual([
      'Поиск: «такси»',
      'Октябрь',
      'Расходы',
      'Такси',
      'Еда',
      '#работа',
      'Uzcard',
    ]);
  });

  it('поиск — отдельный чип с запросом в кавычках', () => {
    expect(buildScopeChips({ ...base, filters: { search: 'такси' } })).toEqual([
      { key: 'search', label: 'Поиск: «такси»' },
    ]);
  });

  it('называет тип по-русски', () => {
    const label = (type: 'income' | 'expense' | 'transfer' | 'debt') =>
      buildScopeChips({ ...base, filters: { type } })[0].label;
    expect(label('expense')).toBe('Расходы');
    expect(label('income')).toBe('Доходы');
    expect(label('transfer')).toBe('Переводы');
    expect(label('debt')).toBe('Долги');
  });

  it('у категории — иконка и цвет, у счёта — точка цвета', () => {
    const [cat, acc] = buildScopeChips({
      ...base,
      filters: { category_ids: ['taxi'], account_ids: ['a-2'] },
    });
    expect(cat).toMatchObject({ icon: 'local_taxi', color: '#F59E0B' });
    expect(cat.dot).toBeUndefined();
    expect(acc).toMatchObject({ dot: '#059669' });
    expect(acc.icon).toBeUndefined();
  });

  it('пропускает неизвестные категории и счета', () => {
    const chips = buildScopeChips({
      ...base,
      filters: { category_ids: ['ghost', 'taxi'], account_ids: ['ghost-acc'] },
    });
    expect(chips.map((c) => c.label)).toEqual(['Такси']);
  });

  it('период — только если фильтр ограничен датами; корректировки чипа не дают', () => {
    expect(buildScopeChips({ ...base, periodLabel: 'Октябрь' })).toEqual([]);
    expect(buildScopeChips({ ...base, periodLabel: '', filters: OCTOBER })).toEqual([]);
    expect(buildScopeChips({ ...base, filters: { type: 'adjustment' } })).toEqual([]);
  });

  it('ключи уникальны', () => {
    const chips = buildScopeChips({
      ...base,
      periodLabel: 'Октябрь',
      filters: {
        ...OCTOBER,
        search: 'кафе',
        type: 'income',
        category_ids: ['taxi', 'food'],
        tags: ['a', 'b'],
        account_ids: ['a-1', 'a-2'],
      },
    });
    expect(new Set(chips.map((c) => c.key)).size).toBe(chips.length);
  });
});
