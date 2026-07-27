import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import type { Transaction } from '@/shared/api/database.types';

/** Сколько чипов показываем. Больше трёх не помещается в одну строку на 393 px. */
const MAX_SUGGESTIONS = 3;
/** Одинокий чип не окупает строку — либо привычка видна, либо блока нет. */
const MIN_SUGGESTIONS = 2;
/** Сумма, встреченная один раз, — не привычка, а случайность. */
const MIN_OCCURRENCES = 2;

interface AmountStat {
  amount: number;
  count: number;
  /** Индекс самой свежей транзакции с этой суммой — список приходит от новых к старым. */
  recency: number;
}

/**
 * Частые суммы пользователя для текущего типа операции и валюты.
 *
 * Смысл: для того, у кого метро всегда 2 000, а кофе 25 000, запись траты
 * сводится к двум тапам. Специально НЕ показываем «просто последние суммы» —
 * подсказка имеет ценность, только если это повторяющаяся привычка, иначе
 * чипы превращаются в шум.
 *
 * Данные берутся из уже загруженного окна `useRecentTransactions(userId, 50)`
 * (то же, что питает smart defaults) — новых запросов не появляется.
 */
export function useAmountSuggestions(
  transactions: MaybeRefOrGetter<Transaction[] | undefined>,
  type: MaybeRefOrGetter<'expense' | 'income' | 'transfer' | 'debt'>,
  currency: MaybeRefOrGetter<string>,
  categoryId?: MaybeRefOrGetter<string>,
) {
  const suggestions = computed<number[]>(() => {
    const all = toValue(transactions);
    const txType = toValue(type);
    const txCurrency = toValue(currency);
    if (!all?.length || (txType !== 'expense' && txType !== 'income')) return [];

    const sameKind = all.filter(
      (tx) => tx.type === txType && tx.currency === txCurrency && tx.amount > 0,
    );

    // Категория выбрана — сначала пробуем подсказки именно по ней: «сколько я
    // обычно трачу на кафе» полезнее, чем «сколько я обычно трачу вообще».
    const selectedCategory = categoryId ? toValue(categoryId) : '';
    const scoped = selectedCategory
      ? sameKind.filter((tx) => tx.category_id === selectedCategory)
      : [];

    const fromScope = rank(scoped);
    return fromScope.length >= MIN_SUGGESTIONS ? fromScope : rank(sameKind);
  });

  return { suggestions };
}

function rank(transactions: Transaction[]): number[] {
  if (!transactions.length) return [];

  const stats = new Map<number, AmountStat>();
  transactions.forEach((tx, index) => {
    const existing = stats.get(tx.amount);
    if (existing) {
      existing.count += 1;
    } else {
      stats.set(tx.amount, { amount: tx.amount, count: 1, recency: index });
    }
  });

  const ranked = [...stats.values()]
    .filter((stat) => stat.count >= MIN_OCCURRENCES)
    .sort((a, b) => b.count - a.count || a.recency - b.recency)
    .slice(0, MAX_SUGGESTIONS);

  return ranked.length >= MIN_SUGGESTIONS ? ranked.map((stat) => stat.amount) : [];
}
