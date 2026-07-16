/** Минимум подтверждений одной категорией, чтобы предлагать её для мерчанта. */
export const CATEGORY_SUGGESTION_MIN_COUNT = 3;

export interface MerchantCategoryRow {
  merchant: string;
  type: 'expense' | 'income';
  categoryId: string;
  cnt: number;
}

export function suggestionKey(merchant: string, type: string): string {
  // merchant приходит из PostgreSQL text, который не может содержать NUL (\u0000) —
  // коллизия составного ключа невозможна
  return `${merchant}\u0000${type}`;
}

/**
 * Строит map «(merchant, type) → categoryId» из агрегированных строк истории.
 * Самая частая категория побеждает; при равных count — меньший categoryId,
 * только ради детерминированности (порядок UUID ничего не означает).
 */
export function buildCategorySuggestionMap(rows: MerchantCategoryRow[]): Map<string, string> {
  const best = new Map<string, MerchantCategoryRow>();
  for (const row of rows) {
    const key = suggestionKey(row.merchant, row.type);
    const current = best.get(key);
    if (
      !current ||
      row.cnt > current.cnt ||
      (row.cnt === current.cnt && row.categoryId < current.categoryId)
    ) {
      best.set(key, row);
    }
  }
  return new Map([...best].map(([key, row]) => [key, row.categoryId]));
}
