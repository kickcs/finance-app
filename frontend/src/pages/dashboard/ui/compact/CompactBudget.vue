<script setup lang="ts">
import { UIcon, Skeleton } from '@/shared/ui';
import { formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { useBudgetProgress } from '@/entities/budget';
import { useDashboardContext } from '../../model/dashboardContext';
import { SECTION_LABEL_CLASS } from './constants';

const { budget, budgetLoading, isHidden, openBudgetSheet } = useDashboardContext();
const { percentage, isOverspent, barColor, barWidth } = useBudgetProgress(budget);
</script>

<template>
  <section
    data-testid="compact-budget"
    class="rounded-2xl bg-card-light dark:bg-card-dark shadow-sm"
  >
    <template v-if="budgetLoading">
      <div class="px-3 py-2.5 space-y-2">
        <div class="flex items-center gap-2">
          <Skeleton class="w-5 h-5 rounded shrink-0" />
          <Skeleton class="h-3 flex-1 rounded" />
          <Skeleton class="h-3 w-16 rounded" />
        </div>
        <Skeleton class="h-1.5 rounded-full" />
      </div>
    </template>
    <template v-else-if="!budget">
      <button
        type="button"
        class="w-full flex items-center justify-between gap-2 px-3 py-3 text-left hover:bg-surface-light dark:hover:bg-surface-dark transition-colors rounded-2xl"
        @click="openBudgetSheet"
      >
        <div class="flex items-center gap-2 min-w-0">
          <div
            class="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark shrink-0"
          >
            <UIcon name="savings" size="xs" />
          </div>
          <div class="min-w-0">
            <p
              class="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
            >
              Установить бюджет
            </p>
            <p
              class="text-caption-sm text-text-tertiary-light dark:text-text-tertiary-dark truncate"
            >
              Контролируйте траты
            </p>
          </div>
        </div>
        <UIcon name="chevron_right" size="sm" class="text-primary shrink-0" />
      </button>
    </template>
    <template v-else>
      <div class="px-3 py-2.5 space-y-1.5">
        <div class="flex items-center gap-2">
          <div
            class="w-5 h-5 rounded-md flex items-center justify-center bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark shrink-0"
          >
            <UIcon name="savings" size="xs" />
          </div>
          <p :class="[SECTION_LABEL_CLASS, 'flex-1']">Бюджет · {{ percentage }}%</p>
          <span
            class="text-caption font-bold tabular-nums shrink-0"
            :class="
              isOverspent ? 'text-danger' : 'text-text-primary-light dark:text-text-primary-dark'
            "
          >
            {{ formatMasked(budget.spent, budget.budget.currency, isHidden, COMPACT_FORMAT) }}
            <span class="text-text-tertiary-light dark:text-text-tertiary-dark font-medium">
              /
              {{
                formatMasked(budget.budget.amount, budget.budget.currency, isHidden, COMPACT_FORMAT)
              }}
            </span>
          </span>
          <button
            type="button"
            aria-label="Изменить бюджет"
            class="text-caption-sm font-semibold text-primary hover:opacity-80 transition-opacity shrink-0"
            @click="openBudgetSheet"
          >
            Изм.
          </button>
        </div>
        <div class="h-1.5 rounded-full overflow-hidden bg-surface-light dark:bg-surface-dark">
          <div
            class="h-full rounded-full transition-all duration-500"
            :style="{ width: barWidth, backgroundColor: barColor }"
          />
        </div>
        <p
          class="text-caption-sm tabular-nums"
          :class="
            isOverspent
              ? 'text-danger font-medium'
              : 'text-text-tertiary-light dark:text-text-tertiary-dark'
          "
        >
          <template v-if="isOverspent">
            Перерасход
            {{
              formatMasked(
                Math.abs(budget.remaining),
                budget.budget.currency,
                isHidden,
                COMPACT_FORMAT,
              )
            }}
          </template>
          <template v-else>
            Осталось
            {{ formatMasked(budget.remaining, budget.budget.currency, isHidden, COMPACT_FORMAT) }}
          </template>
        </p>
      </div>
    </template>
  </section>
</template>
