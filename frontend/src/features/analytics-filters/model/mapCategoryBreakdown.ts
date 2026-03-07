import type { CategoryBreakdown } from '@/entities/transaction';
import type { CategoryStat } from './types';

/**
 * Transform server CategoryBreakdown[] into sorted CategoryStat[]
 * with calculated percentages. Optionally filter by type.
 * Supports multi-currency conversion via optional convertFn.
 */
export function mapCategoryStats(
  breakdown: CategoryBreakdown[],
  type?: 'expense' | 'income',
  convertFn?: (amount: number, currency: string) => number,
): CategoryStat[] {
  const filtered = type ? breakdown.filter((c) => c.type === type) : breakdown;

  const mapped = filtered.map((c) => {
    // Convert using amountByCurrency if convertFn provided, else fallback to raw amount
    const convertedAmount = convertFn
      ? Object.entries(c.amountByCurrency).reduce(
          (sum, [curr, amt]) => sum + convertFn(amt, curr),
          0,
        )
      : c.amount;

    return {
      id: c.categoryId,
      name: c.categoryName,
      icon: c.categoryIcon,
      color: c.categoryColor,
      amount: convertedAmount,
      percent: 0, // calculated below
    };
  });

  const total = mapped.reduce((sum, c) => sum + c.amount, 0);
  if (total === 0) return [];

  return mapped
    .map((c) => ({ ...c, percent: (c.amount / total) * 100 }))
    .sort((a, b) => b.amount - a.amount);
}

/** Shorthand: expense-only stats */
export function mapExpenseCategoryStats(
  breakdown: CategoryBreakdown[],
  convertFn?: (amount: number, currency: string) => number,
): CategoryStat[] {
  return mapCategoryStats(breakdown, 'expense', convertFn);
}
