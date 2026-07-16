import { describe, it, expect } from 'vitest';
import { decideCategoryPrefill } from './categoryPrefill';

const pool = [{ id: 'cat-transport' }, { id: 'cat-food' }];

describe('decideCategoryPrefill', () => {
  it('apply: подсказка есть, категория в списке, поле пустое', () => {
    expect(
      decideCategoryPrefill({ suggestedCategoryId: 'cat-transport', currentCategoryId: '', pool }),
    ).toBe('apply');
  });

  it('skip: подсказки нет', () => {
    expect(decideCategoryPrefill({ suggestedCategoryId: null, currentCategoryId: '', pool })).toBe(
      'skip',
    );
  });

  it('skip: пользователь уже выбрал категорию', () => {
    expect(
      decideCategoryPrefill({
        suggestedCategoryId: 'cat-transport',
        currentCategoryId: 'cat-food',
        pool,
      }),
    ).toBe('skip');
  });

  it('skip: категория удалена (нет в списке)', () => {
    expect(
      decideCategoryPrefill({ suggestedCategoryId: 'cat-deleted', currentCategoryId: '', pool }),
    ).toBe('skip');
  });

  it('wait: категории ещё не загружены', () => {
    expect(
      decideCategoryPrefill({
        suggestedCategoryId: 'cat-transport',
        currentCategoryId: '',
        pool: [],
      }),
    ).toBe('wait');
  });
});
