import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { useSessionStorage } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
import {
  ALL_CATEGORIES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  DEBT_CATEGORIES,
  TRANSFER_CATEGORY,
  useCategories,
} from '@/entities/category';
import {
  stripHash,
  TRANSACTION_TYPE_LABELS,
  type LabeledTransactionType,
  type TransactionFilters,
} from '@/entities/transaction';
import { PERIOD_PRESETS, resolvePeriod, type HistoryPeriod } from '../lib/historyPeriod';
import { FACETS, type FacetName, type FacetValues } from './facets';

export type TypeFilter = 'all' | LabeledTransactionType;

export const TYPE_FILTER_ITEMS = [
  { id: 'all', label: 'Все' },
  ...Object.entries(TRANSACTION_TYPE_LABELS).map(([id, label]) => ({ id, label })),
];

interface StoredHistoryFilters extends FacetValues {
  type: TypeFilter;
}

const TYPE_VALUES = TYPE_FILTER_ITEMS.map((item) => item.id);
const PRESET_VALUES: string[] = [...PERIOD_PRESETS.map((preset) => preset.id), 'custom'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function createDefaults(): StoredHistoryFilters {
  return { type: 'all', categoryIds: [], tags: [], accountIds: [], period: null };
}

/** Список без повторов и не-строк; `legacy` — одиночное значение из прежней формы хранилища. */
function toStringList(list: unknown, legacy?: unknown): string[] {
  const items = Array.isArray(list) ? list : typeof legacy === 'string' ? [legacy] : [];
  return [...new Set(items.filter((x): x is string => typeof x === 'string' && x !== ''))];
}

function toIsoDate(value: unknown): string | null {
  return typeof value === 'string' && ISO_DATE.test(value) ? value : null;
}

function toPeriod(raw: unknown): HistoryPeriod | null {
  if (!raw || typeof raw !== 'object') return null;
  const { preset, from, to } = raw as Record<string, unknown>;
  if (typeof preset !== 'string' || !PRESET_VALUES.includes(preset)) return null;
  const kind = preset as HistoryPeriod['preset'];
  return kind === 'custom'
    ? { preset: kind, from: toIsoDate(from), to: toIsoDate(to) }
    : { preset: kind, from: null, to: null };
}

/**
 * Приводит к новой форме всё, что могло лежать в `sessionStorage` (прежняя форма, битый JSON):
 * страница не должна падать из-за состояния, оставшегося от прошлой версии приложения.
 */
export function normalizeStoredFilters(raw: unknown): StoredHistoryFilters {
  if (!raw || typeof raw !== 'object') return createDefaults();
  const r = raw as Record<string, unknown>;
  return {
    type: TYPE_VALUES.includes(r.type as string) ? (r.type as TypeFilter) : 'all',
    categoryIds: toStringList(r.categoryIds, r.categoryId),
    accountIds: toStringList(r.accountIds, r.accountId),
    tags: [...new Set(toStringList(r.tags).map(stripHash))].filter(Boolean),
    period: toPeriod(r.period),
  };
}

function parseStored(raw: string): StoredHistoryFilters {
  try {
    return normalizeStoredFilters(JSON.parse(raw));
  } catch {
    return createDefaults();
  }
}

/** Пустой список в фильтр не попадает: иначе в ключ кэша уходил бы лишний `[]`. */
const orUndefined = <T>(list: T[]): T[] | undefined => (list.length > 0 ? list : undefined);

export function useHistoryFilters(userId: MaybeRefOrGetter<string | null>) {
  const { startDay } = useFinancialPeriod();

  // Фильтры переживают уход со страницы до конца сессии; новый запуск начинает с «Все».
  // Свой serializer: стандартный отдал бы старую форму как есть, а чтение полей новой упало бы.
  const stored = useSessionStorage<StoredHistoryFilters>(
    STORAGE_KEYS.HISTORY_FILTERS,
    createDefaults(),
    { serializer: { read: parseStored, write: (value) => JSON.stringify(value) } },
  );

  function patch(partial: Partial<StoredHistoryFilters>) {
    stored.value = { ...stored.value, ...partial };
  }

  const activeTypeFilter = computed({
    get: () => stored.value.type,
    set: (type: TypeFilter) => patch({ type }),
  });
  const selectedCategoryIds = computed({
    get: () => stored.value.categoryIds,
    set: (categoryIds: string[]) => patch({ categoryIds }),
  });
  const selectedTags = computed({
    get: () => stored.value.tags,
    set: (tags: string[]) => patch({ tags }),
  });
  const selectedAccountIds = computed({
    get: () => stored.value.accountIds,
    set: (accountIds: string[]) => patch({ accountIds }),
  });
  const period = computed({
    get: () => stored.value.period,
    set: (value: HistoryPeriod | null) => patch({ period: value }),
  });
  /** Все чипы разом — так их читают ряд чипов и шторка выбора. */
  const facetValues = computed<FacetValues>({
    get: () => {
      const { period: p, categoryIds, tags, accountIds } = stored.value;
      return { period: p, categoryIds, tags, accountIds };
    },
    set: (values) => patch(values),
  });

  const activeFacetCount = computed(
    () => Object.values(FACETS).filter((facet) => facet.isSet(stored.value)).length,
  );

  const hasActiveFilters = computed(
    () => activeTypeFilter.value !== 'all' || activeFacetCount.value > 0,
  );

  const serverFilters = computed<TransactionFilters>(() => {
    // «Сейчас» берём при каждом вычислении, чтобы пресеты оставались относительными.
    const { startDate, endDate } = resolvePeriod(period.value, new Date(), startDay.value);
    return {
      type: activeTypeFilter.value !== 'all' ? activeTypeFilter.value : undefined,
      category_ids: orUndefined(selectedCategoryIds.value),
      account_ids: orUndefined(selectedAccountIds.value),
      tags: orUndefined(selectedTags.value),
      start_date: startDate,
      end_date: endDate,
    };
  });

  // User categories from API + fallback to static
  const {
    allCategories: userCategories,
    expenseCategories: userExpenseCategories,
    incomeCategories: userIncomeCategories,
    isLoading: isLoadingCategories,
  } = useCategories(userId);

  function categoriesForType(type: TypeFilter) {
    const uid = toValue(userId);
    const useDefaults = isLoadingCategories.value || (!uid && userCategories.value.length === 0);

    switch (type) {
      case 'expense':
        return useDefaults ? EXPENSE_CATEGORIES : userExpenseCategories.value;
      case 'income':
        return useDefaults ? INCOME_CATEGORIES : userIncomeCategories.value;
      case 'debt':
        return DEBT_CATEGORIES;
      case 'transfer':
        return [TRANSFER_CATEGORY];
      case 'all':
      default:
        return useDefaults ? ALL_CATEGORIES : userCategories.value;
    }
  }

  const usedCategories = computed(() => categoriesForType(activeTypeFilter.value));

  /** Меняет вкладку и оставляет только те категории, что на ней существуют: выбор не пропадает зря. */
  function handleTypeFilterChange(val: string) {
    const type = val as TypeFilter;
    // У переводов категорий нет, и чип «Категория» там скрыт — выбор нечем было бы снять.
    const keep =
      type === 'transfer'
        ? []
        : type === 'all'
          ? selectedCategoryIds.value
          : selectedCategoryIds.value.filter((id) =>
              categoriesForType(type).some((category) => category.id === id),
            );
    patch({ type, categoryIds: keep });
  }

  /**
   * После переноса в категорию показываем её, а не опустевший список. Прочие чипы остаются;
   * тип сбрасывается, только если на его вкладке такой категории нет.
   */
  function showAfterCategoryMove(categoryId: string) {
    const type = activeTypeFilter.value;
    const fits = type === 'all' || categoriesForType(type).some((c) => c.id === categoryId);
    patch(fits ? { categoryIds: [categoryId] } : { type: 'all', categoryIds: [categoryId] });
  }

  /** Строки стали переводами: под прежними типом, категориями и тегами не осталось бы ни одной. */
  function showAfterTransfer(accountId: string) {
    patch({ type: 'all', categoryIds: [], tags: [], accountIds: [accountId] });
  }

  function clearFacet(name: FacetName) {
    patch(FACETS[name].cleared);
  }

  function resetAll() {
    stored.value = createDefaults();
  }

  return {
    activeTypeFilter,
    selectedCategoryIds,
    selectedTags,
    selectedAccountIds,
    period,
    facetValues,
    serverFilters,
    activeFacetCount,
    hasActiveFilters,
    usedCategories,
    handleTypeFilterChange,
    showAfterCategoryMove,
    showAfterTransfer,
    clearFacet,
    resetAll,
  };
}
