export type CategoryPrefillDecision = 'apply' | 'skip' | 'wait';

/**
 * Решение об автоподстановке предложенной категории в форму подтверждения.
 * 'wait' — категории ещё грузятся, решение откладывается до следующего срабатывания watch.
 */
export function decideCategoryPrefill(params: {
  suggestedCategoryId: string | null;
  currentCategoryId: string;
  pool: Array<{ id: string }>;
}): CategoryPrefillDecision {
  const { suggestedCategoryId, currentCategoryId, pool } = params;
  if (!suggestedCategoryId) return 'skip';
  if (pool.length === 0) return 'wait';
  if (currentCategoryId !== '') return 'skip';
  if (!pool.some((category) => category.id === suggestedCategoryId)) return 'skip';
  return 'apply';
}
