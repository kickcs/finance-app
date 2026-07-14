import type { Category } from './types';

/** Нормализация для поиска: нижний регистр, ё→е, схлопывание пробелов. */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').trim().replace(/\s+/g, ' ');
}

/**
 * Фильтрует и ранжирует категории по запросу:
 * совпадения по началу слова — выше совпадений в середине.
 * Пустой запрос возвращает исходный список.
 */
export function searchCategories(categories: Category[], query: string): Category[] {
  const q = normalizeSearchText(query);
  if (!q) return categories;

  const prefixMatches: Category[] = [];
  const substringMatches: Category[] = [];

  for (const category of categories) {
    const name = normalizeSearchText(category.name);
    const words = name.split(/[\s\-/]+/);
    if (words.some((w) => w.startsWith(q))) {
      prefixMatches.push(category);
    } else if (name.includes(q)) {
      substringMatches.push(category);
    }
  }

  return [...prefixMatches, ...substringMatches];
}
