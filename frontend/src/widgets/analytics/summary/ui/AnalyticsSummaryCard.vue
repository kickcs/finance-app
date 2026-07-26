<script setup lang="ts">
import { computed } from 'vue';
import { UCard, UIcon, Skeleton } from '@/shared/ui';
import { useCountUp } from '@/shared/lib/hooks/useCountUp';
import {
  formatCurrency,
  formatPercentage,
  COMPACT_FORMAT,
  COMPACT_BARE_FORMAT,
} from '@/shared/lib/format/currency';

const props = defineProps<{
  income: number;
  expense: number;
  availableBalance: number;
  daysInPeriod: number;
  daysRemaining: number;
  currency: string;
  /** Бюджет периода в валюте пользователя; 0 или undefined — бюджет не задан. */
  budgetAmount?: number;
  /** Изменение расхода к прошлому периоду в процентах. */
  comparisonPercent?: number;
  isPastPeriod?: boolean;
  /** «По выбранным счетам» — когда доступный остаток посчитан не по всем счетам. */
  balanceLabel?: string;
  loading?: boolean;
}>();

const animated = useCountUp({
  income: () => props.income,
  expense: () => props.expense,
});

/**
 * Метрики в трёх колонках идут без символа валюты: он назван в заголовочной
 * сумме прямо над ними, а в узкой колонке отнимал бы место у самого числа.
 */
function formatBare(value: number): string {
  return formatCurrency(value, props.currency, COMPACT_BARE_FORMAT);
}

const balance = computed(() => animated.income.value - animated.expense.value);

const avgDailyExpense = computed(() =>
  props.daysInPeriod <= 0 ? 0 : props.expense / props.daysInPeriod,
);

const safeDaily = computed(() =>
  props.daysRemaining <= 0 ? props.availableBalance : props.availableBalance / props.daysRemaining,
);

const hasBudget = computed(() => !!props.budgetAmount && props.budgetAmount > 0);

/** Доля бюджета, которую уже съели расходы. Может быть больше 100. */
const spentPercent = computed(() =>
  hasBudget.value ? (props.expense / props.budgetAmount!) * 100 : 0,
);

/** Доля периода, которая уже прошла. Для завершённого периода — весь он. */
const elapsedPercent = computed(() => {
  if (props.isPastPeriod || props.daysInPeriod <= 0) return 100;
  const elapsed = props.daysInPeriod - props.daysRemaining;
  return Math.min(100, Math.max(0, (elapsed / props.daysInPeriod) * 100));
});

/** Маркер «сегодня» имеет смысл только на незавершённом периоде с бюджетом. */
const showTodayMarker = computed(
  () => hasBudget.value && !props.isPastPeriod && elapsedPercent.value < 100,
);

/**
 * Три состояния вместо двух: «уложился в бюджет, но тратишь быстрее срока» —
 * это предупреждение, а не провал, и отличать его от перерасхода полезно.
 */
const paceStatus = computed<'good' | 'warning' | 'danger'>(() => {
  if (!hasBudget.value) return props.expense > props.income ? 'warning' : 'good';
  if (spentPercent.value >= 100) return 'danger';
  if (spentPercent.value > elapsedPercent.value) return 'warning';
  return 'good';
});

const STATUS_STYLES = {
  good: { fill: 'bg-success', text: 'text-success' },
  warning: { fill: 'bg-warning', text: 'text-warning' },
  danger: { fill: 'bg-danger', text: 'text-danger' },
} as const;

/** Без бюджета полоса показывает расход относительно дохода. */
const fillPercent = computed(() => {
  if (hasBudget.value) return Math.min(100, spentPercent.value);
  const max = Math.max(props.income, props.expense, 1);
  return (props.expense / max) * 100;
});

const barCaption = computed(() => {
  if (hasBudget.value) {
    return `${formatPercentage(spentPercent.value, 0)} от ${formatCurrency(props.budgetAmount!, props.currency, COMPACT_FORMAT)}`;
  }
  return props.income > 0 ? 'расход к доходу' : 'расходы за период';
});

const remainingCaption = computed(() => {
  if (props.isPastPeriod) return 'период завершён';
  if (props.daysRemaining <= 0) return 'последний день';
  return `осталось ${props.daysRemaining} дн.`;
});

const comparisonVisible = computed(() => props.comparisonPercent !== undefined);

/** Рост расходов — плохо, поэтому знак и цвет здесь развёрнуты против интуиции. */
const comparisonClass = computed(() =>
  (props.comparisonPercent ?? 0) > 0 ? 'text-danger bg-danger/10' : 'text-success bg-success/10',
);
</script>

<template>
  <UCard padding="md">
    <template v-if="loading">
      <div class="space-y-3">
        <Skeleton class="h-4 w-28 rounded" />
        <Skeleton class="h-8 w-48 rounded" />
        <Skeleton class="h-2 w-full rounded-full" />
        <div class="grid grid-cols-3 gap-2 pt-1">
          <Skeleton v-for="i in 3" :key="i" class="h-10 rounded" />
        </div>
      </div>
    </template>

    <template v-else>
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
          Расход за период
        </span>
        <span
          v-if="comparisonVisible"
          class="shrink-0 px-1.5 py-0.5 rounded-md text-caption-sm font-semibold leading-none"
          :class="comparisonClass"
        >
          {{ formatPercentage(comparisonPercent!, 0, true) }}
        </span>
      </div>

      <p
        data-testid="summary-expense"
        class="mt-0.5 text-h2 font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark truncate"
      >
        {{ formatCurrency(animated.expense.value, currency, COMPACT_FORMAT) }}
      </p>

      <!-- Полоса бюджета с маркером «сегодня»: заливка левее маркера — идёте с
           запасом, правее — обгоняете срок. Один взгляд вместо сравнения двух
           процентов в уме. -->
      <div class="mt-3">
        <div
          class="relative h-2 rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden"
          role="progressbar"
          :aria-valuenow="Math.round(fillPercent)"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="hasBudget ? 'Израсходовано от бюджета' : 'Расход относительно дохода'"
        >
          <div
            class="h-full rounded-full transition-[width] duration-500 ease-out"
            :class="STATUS_STYLES[paceStatus].fill"
            :style="{ width: `${fillPercent}%` }"
          />
        </div>

        <div v-if="showTodayMarker" class="relative h-0">
          <span
            class="absolute -top-3.5 w-px h-3.5 bg-text-primary-light dark:bg-text-primary-dark"
            :style="{ left: `${elapsedPercent}%` }"
            aria-hidden="true"
          />
          <span
            class="absolute top-0.5 -translate-x-1/2 text-caption-xs text-text-tertiary-light dark:text-text-tertiary-dark whitespace-nowrap"
            :style="{ left: `${elapsedPercent}%` }"
          >
            сегодня
          </span>
        </div>

        <div
          class="flex items-center justify-between gap-2 text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
          :class="showTodayMarker ? 'mt-4' : 'mt-1.5'"
        >
          <span class="truncate">{{ barCaption }}</span>
          <span class="shrink-0">{{ remainingCaption }}</span>
        </div>
      </div>

      <!-- Фиксированные колонки: в прежних карточках метка и сумма делили ширину
           в justify-between, и длинные значения рвали строку. -->
      <div
        class="mt-3 pt-3 grid grid-cols-3 gap-2 border-t border-border-light dark:border-border-dark"
      >
        <div class="min-w-0">
          <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">Доход</p>
          <p class="text-body-sm font-semibold text-success tabular-nums truncate">
            {{ formatBare(animated.income.value) }}
          </p>
        </div>

        <div class="min-w-0">
          <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">Баланс</p>
          <p
            class="text-body-sm font-semibold tabular-nums truncate"
            :class="
              balance >= 0 ? 'text-text-primary-light dark:text-text-primary-dark' : 'text-danger'
            "
          >
            {{ formatBare(balance) }}
          </p>
        </div>

        <div class="min-w-0">
          <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">В день</p>
          <p
            class="text-body-sm font-semibold text-text-primary-light dark:text-text-primary-dark tabular-nums truncate"
          >
            {{ formatBare(avgDailyExpense) }}
          </p>
        </div>
      </div>

      <!-- Самое действенное число периода: сколько можно тратить в день и не уйти в минус. -->
      <div
        v-if="!isPastPeriod"
        data-testid="summary-safe-daily"
        class="mt-2.5 flex items-center gap-1.5 text-caption"
        :class="STATUS_STYLES[safeDaily < avgDailyExpense ? 'warning' : 'good'].text"
      >
        <UIcon :name="safeDaily < avgDailyExpense ? 'warning' : 'check_circle'" size="xs" />
        <span class="min-w-0 truncate">
          Можно тратить
          {{ formatCurrency(Math.max(0, safeDaily), currency, COMPACT_FORMAT) }}/день
          <template v-if="balanceLabel">· {{ balanceLabel.toLowerCase() }}</template>
        </span>
      </div>
    </template>
  </UCard>
</template>
