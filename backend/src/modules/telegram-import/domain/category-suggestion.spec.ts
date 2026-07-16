import {
  buildCategorySuggestionMap,
  suggestionKey,
  type MerchantCategoryRow,
} from './category-suggestion';

const row = (partial: Partial<MerchantCategoryRow>): MerchantCategoryRow => ({
  merchant: 'YandexGO Taxi UB OPL',
  type: 'expense',
  categoryId: 'cat-transport',
  cnt: 5,
  ...partial,
});

describe('buildCategorySuggestionMap', () => {
  it('возвращает категорию мерчанта по ключу (merchant, type)', () => {
    const map = buildCategorySuggestionMap([row({})]);
    expect(map.get(suggestionKey('YandexGO Taxi UB OPL', 'expense'))).toBe('cat-transport');
  });

  it('при нескольких категориях мерчанта выбирает самую частую', () => {
    const map = buildCategorySuggestionMap([
      row({ categoryId: 'cat-transport', cnt: 7 }),
      row({ categoryId: 'cat-food', cnt: 3 }),
    ]);
    expect(map.get(suggestionKey('YandexGO Taxi UB OPL', 'expense'))).toBe('cat-transport');
  });

  it('при равных count берёт детерминированный tiebreak (меньший categoryId)', () => {
    const map = buildCategorySuggestionMap([
      row({ categoryId: 'cat-b', cnt: 3 }),
      row({ categoryId: 'cat-a', cnt: 3 }),
    ]);
    expect(map.get(suggestionKey('YandexGO Taxi UB OPL', 'expense'))).toBe('cat-a');
  });

  it('разные типы одного мерчанта не смешиваются', () => {
    const map = buildCategorySuggestionMap([
      row({ type: 'expense', categoryId: 'cat-transport' }),
      row({ type: 'income', categoryId: 'cat-refund' }),
    ]);
    expect(map.get(suggestionKey('YandexGO Taxi UB OPL', 'expense'))).toBe('cat-transport');
    expect(map.get(suggestionKey('YandexGO Taxi UB OPL', 'income'))).toBe('cat-refund');
  });

  it('пустой вход → пустая map', () => {
    expect(buildCategorySuggestionMap([]).size).toBe(0);
  });
});
