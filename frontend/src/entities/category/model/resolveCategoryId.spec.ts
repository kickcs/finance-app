import { describe, it, expect } from 'vitest';
import { resolveCategoryId } from './resolveCategoryId';
import type { Category } from './types';

function cat(id: string, name: string, icon = 'star'): Category {
  return { id, name, icon, color: '#000', type: 'income' };
}

describe('resolveCategoryId', () => {
  it('оставляет встроенный id, если он есть в списке (демо-режим)', () => {
    expect(resolveCategoryId([cat('gifts_income', 'Подарки')], 'gifts_income')).toBe(
      'gifts_income',
    );
  });

  it('находит категорию пользователя по имени встроенной', () => {
    const list = [cat('u-1', 'Зарплата'), cat('u-2', 'Подарки')];
    expect(resolveCategoryId(list, 'gifts_income')).toBe('u-2');
  });

  it('без совпадения по имени ищет по иконке', () => {
    const list = [cat('u-1', 'Зарплата'), cat('u-2', 'Презенты', 'redeem')];
    expect(resolveCategoryId(list, 'gifts_income')).toBe('u-2');
  });

  it('иначе берёт первую категорию списка', () => {
    expect(resolveCategoryId([cat('u-1', 'Зарплата')], 'gifts_income')).toBe('u-1');
  });

  it('имя сравнивает без учёта регистра и пробелов', () => {
    expect(
      resolveCategoryId([cat('u-1', 'Зарплата'), cat('u-2', ' подарки ')], 'gifts_income'),
    ).toBe('u-2');
  });

  // Встроенный id в пустом списке — та самая ссылка на несуществующую категорию.
  it('на пустом списке ничего не выбирает', () => {
    expect(resolveCategoryId([], 'gifts_income')).toBe('');
  });
});
