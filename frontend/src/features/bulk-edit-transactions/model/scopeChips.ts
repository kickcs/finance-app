import type { Category } from '@/entities/category';
import { transactionTypeLabel, type TransactionFilters } from '@/entities/transaction';

export interface ScopeChip {
  key: string;
  label: string;
  /** Категория: иконка и её цвет. */
  icon?: string;
  color?: string;
  /** Счёт: цвет точки. */
  dot?: string;
}

export interface ScopeChipsInput {
  /** Тот же фильтр, что уходит в выборку «Изменить все». */
  filters: TransactionFilters;
  /** Подпись периода: показывается, только если фильтр ограничен датами. */
  periodLabel?: string | null;
  categories: Category[];
  accounts: { id: string; name: string; color: string }[];
}

/** Чипы блока охвата: что именно попадает под «Изменить все». Неизвестные id молча пропускаются. */
export function buildScopeChips({
  filters,
  periodLabel,
  categories,
  accounts,
}: ScopeChipsInput): ScopeChip[] {
  const chips: ScopeChip[] = [];

  if (filters.search) chips.push({ key: 'search', label: `Поиск: «${filters.search}»` });

  if (periodLabel && (filters.start_date || filters.end_date)) {
    chips.push({ key: 'period', label: periodLabel });
  }

  const typeLabel = transactionTypeLabel(filters.type);
  if (typeLabel) chips.push({ key: 'type', label: typeLabel });

  for (const id of filters.category_ids ?? []) {
    const category = categories.find((c) => c.id === id);
    if (category) {
      chips.push({
        key: `cat:${id}`,
        label: category.name,
        icon: category.icon,
        color: category.color,
      });
    }
  }

  for (const tag of filters.tags ?? []) chips.push({ key: `tag:${tag}`, label: `#${tag}` });

  for (const id of filters.account_ids ?? []) {
    const account = accounts.find((a) => a.id === id);
    if (account) chips.push({ key: `acc:${id}`, label: account.name, dot: account.color });
  }

  return chips;
}
