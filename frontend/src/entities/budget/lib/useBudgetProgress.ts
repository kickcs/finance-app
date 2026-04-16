import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import type { BudgetCurrentResponse } from '../model/types';
import { getBudgetColor } from './budgetColor';

/**
 * Derives reactive progress-bar metadata from a budget response.
 * Returns spent percentage, overspent flag, bar color (danger when overspent
 * else color from `getBudgetColor`), and the clamped CSS width string.
 */
export function useBudgetProgress(budget: MaybeRefOrGetter<BudgetCurrentResponse | null>) {
  const percentage = computed(() => toValue(budget)?.percentage ?? 0);
  const isOverspent = computed(() => (toValue(budget)?.remaining ?? 0) < 0);
  const barColor = computed(() =>
    isOverspent.value ? 'var(--color-danger)' : getBudgetColor(percentage.value),
  );
  const barWidth = computed(() => `${Math.min(percentage.value, 100)}%`);

  return { percentage, isOverspent, barColor, barWidth };
}
