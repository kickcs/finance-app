import type { Category } from './types';
import type { Transaction } from '@/shared/api/database.types';

const MIN_TRANSACTIONS_FOR_STATS = 5;

/**
 * Топ-N категорий по частоте употребления в последних транзакциях.
 * При недостатке истории (< 5 релевантных транзакций) — fallback на ручной флажок isFrequent;
 * если пользователь выключил isFrequent у всех категорий — показываем первые topN по порядку БД,
 * чтобы инлайн-часть пикера не осталась без единого чипа.
 * Если по статистике набралось меньше topN — добор: isFrequent-категории, затем порядок БД.
 */
export function getFrequentCategories(
  categories: Category[],
  transactions: Transaction[] | undefined,
  topN = 8,
): Category[] {
  const manualFrequent = categories.filter((c) => c.isFrequent !== false);

  const knownIds = new Set(categories.map((c) => c.id));
  // Порог считаем только по транзакциям переданных категорий (тип панели),
  // иначе окно, забитое переводами/долгами, проходит порог с 1-2 точками данных
  const relevant = transactions?.filter((tx) => knownIds.has(tx.category_id)) ?? [];

  if (relevant.length < MIN_TRANSACTIONS_FOR_STATS) {
    const fallbackPool = manualFrequent.length > 0 ? manualFrequent : categories;
    return fallbackPool.slice(0, topN);
  }

  const counts = new Map<string, number>();
  for (const tx of relevant) {
    counts.set(tx.category_id, (counts.get(tx.category_id) ?? 0) + 1);
  }

  // Array.prototype.sort стабилен: при равной частоте сохраняется порядок БД
  const ranked = categories
    .filter((c) => counts.has(c.id))
    .sort((a, b) => counts.get(b.id)! - counts.get(a.id)!)
    .slice(0, topN);

  if (ranked.length < topN) {
    const used = new Set(ranked.map((c) => c.id));
    for (const c of [...manualFrequent, ...categories]) {
      if (ranked.length >= topN) break;
      if (!used.has(c.id)) {
        ranked.push(c);
        used.add(c.id);
      }
    }
  }

  return ranked;
}
