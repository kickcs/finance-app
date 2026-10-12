import { getCategoryById } from './constants';
import { normalizeSearchText } from './categorySearch';
import type { Category } from './types';

/**
 * Сопоставляет встроенную категорию (`gifts_income`) с категорией пользователя.
 * У реальных пользователей категории хранятся под своими id, и встроенный id
 * в их списке не найдётся — поэтому ищем по имени, затем по иконке встроенной.
 * Пустая строка — категории ещё не пришли: выбирать пока не из чего.
 */
export function resolveCategoryId(categories: Category[], builtinId: string): string {
  const builtin = getCategoryById(builtinId);
  const builtinName = builtin && normalizeSearchText(builtin.name);
  const match =
    categories.find((c) => c.id === builtinId) ??
    categories.find((c) => normalizeSearchText(c.name) === builtinName) ??
    categories.find((c) => c.icon === builtin?.icon) ??
    categories[0];
  return match?.id ?? '';
}
