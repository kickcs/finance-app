import type { CategoryBreakdown } from '@/entities/transaction';
import type { CategoryStat } from './types';

/**
 * Transform server CategoryBreakdown[] into sorted CategoryStat[]
 * with calculated percentages. Optionally filter by type.
 */
export function mapCategoryStats(
  breakdown: CategoryBreakdown[],
  type?: 'expense' | 'income',
): CategoryStat[] {
  const filtered = type ? breakdown.filter((c) => c.type === type) : breakdown;
  const total = filtered.reduce((sum, c) => sum + c.amount, 0);
  if (total === 0) return [];

  return filtered
    .map((c) => ({
      id: c.categoryId,
      name: c.categoryName,
      icon: c.categoryIcon,
      color: c.categoryColor,
      amount: c.amount,
      percent: (c.amount / total) * 100,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Shorthand: expense-only stats */
export function mapExpenseCategoryStats(breakdown: CategoryBreakdown[]): CategoryStat[] {
  return mapCategoryStats(breakdown, 'expense');
}
