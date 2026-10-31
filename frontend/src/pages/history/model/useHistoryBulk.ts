import { computed, type Ref } from 'vue';
import type { Category } from '@/entities/category';
import type { Transaction, TransactionFilters } from '@/entities/transaction';

type CategoryType = 'expense' | 'income';

export interface HistoryBulkOptions {
  mode: Readonly<Ref<'all' | 'manual'>>;
  filters: () => TransactionFilters;
  selectedRows: () => Transaction[];
  /** Категории текущей вкладки: по ним выбранные в фильтре id дают типы выборки. */
  categories: () => Category[];
}

/** Цели массового переноса: группы категорий по типам выборки и категория, из которой переносим. */
export function useHistoryBulk(options: HistoryBulkOptions) {
  const isManual = () => options.mode.value === 'manual';

  // Ручной выбор знает типы строк; «Изменить все» — только фильтр.
  const categoryTypes = computed<CategoryType[]>(() => {
    const { type, category_ids: categoryIds = [] } = options.filters();
    const kinds = new Set<string>(
      isManual()
        ? options.selectedRows().map((tx) => tx.type)
        : type === 'expense' || type === 'income'
          ? [type]
          : options
              .categories()
              .filter((c) => categoryIds.includes(c.id))
              .map((c) => c.type),
    );
    if (kinds.size === 0) return ['expense', 'income'];
    const types: CategoryType[] = [];
    if (kinds.has('expense') || !kinds.has('income')) types.push('expense');
    if (kinds.has('income')) types.push('income');
    return types;
  });

  const sourceCategoryIds = computed(() =>
    isManual()
      ? [...new Set(options.selectedRows().map((tx) => tx.category_id))]
      : (options.filters().category_ids ?? []),
  );

  return { categoryTypes, sourceCategoryIds };
}
