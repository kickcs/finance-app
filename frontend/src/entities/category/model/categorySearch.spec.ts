import { describe, it, expect } from 'vitest';
import { normalizeSearchText, searchCategories } from './categorySearch';
import type { Category } from './types';

function makeCat(id: string, name: string): Category {
  return { id, name, icon: 'restaurant', color: '#f00', type: 'expense' };
}

describe('normalizeSearchText', () => {
  it('приводит к нижнему регистру и обрезает пробелы', () => {
    expect(normalizeSearchText('  ЕдА  ')).toBe('еда');
  });

  it('заменяет ё на е', () => {
    expect(normalizeSearchText('Копилка-мёд')).toBe('копилка-мед');
  });

  it('схлопывает множественные пробелы', () => {
    expect(normalizeSearchText('дом   и   быт')).toBe('дом и быт');
  });
});

describe('searchCategories', () => {
  const cats = [
    makeCat('food', 'Еда и напитки'),
    makeCat('transport', 'Транспорт'),
    makeCat('sport', 'Спорт'),
    makeCat('honey', 'Мёд'),
  ];

  it('пустой запрос возвращает все категории', () => {
    expect(searchCategories(cats, '')).toEqual(cats);
    expect(searchCategories(cats, '   ')).toEqual(cats);
  });

  it('находит по началу любого слова', () => {
    expect(searchCategories(cats, 'нап').map((c) => c.id)).toEqual(['food']);
  });

  it('prefix-совпадения ранжируются выше совпадений в середине слова', () => {
    // 'спорт': prefix у 'Спорт', substring у 'Транспорт'
    expect(searchCategories(cats, 'спорт').map((c) => c.id)).toEqual(['sport', 'transport']);
  });

  it('ищет без учёта ё/е и регистра', () => {
    expect(searchCategories(cats, 'МЕД').map((c) => c.id)).toEqual(['honey']);
  });

  it('возвращает пустой массив, если ничего не найдено', () => {
    expect(searchCategories(cats, 'xyz')).toEqual([]);
  });
});
