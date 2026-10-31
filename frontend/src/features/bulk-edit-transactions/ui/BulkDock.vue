<script setup lang="ts">
import { computed } from 'vue';
import { UButton, UIcon } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import type { TransactionsSummary } from '@/entities/transaction';
import { summaryLabel } from '../model/bulkTexts';
import { formatTotals } from '../lib/formatTotals';

const props = defineProps<{
  /** Итог выборки; пока его нет, плашка рисует скелетон той же высоты */
  summary?: TransactionsSummary;
  isFiltered: boolean;
  selectDisabled?: boolean;
  /** Итог прежнего фильтра, пока считается новый: числа видны, но «Изменить все» ждёт свежих. */
  stale?: boolean;
}>();

defineEmits<{
  select: [];
  editAll: [];
}>();

const label = computed(() => (props.summary ? summaryLabel(props.summary, props.isFiltered) : ''));

// Компактно, как суммы в ленте: на 360–390 px полная сумма рядом с двумя кнопками не помещается
const total = computed(() => formatTotals(props.summary?.totals ?? [], { compact: true }));

const eligibleCount = computed(() => props.summary?.eligible_count ?? 0);
const showEditAll = computed(() => props.isFiltered && eligibleCount.value > 0);
const selectBlocked = computed(() => props.selectDisabled || props.summary?.count === 0);

// Плашка всегда тёмная, в обеих темах: у UButton нет варианта для светлой кнопки на тёмном
// (ghost/secondary рассчитаны на светлую подложку), поэтому тихая кнопка — своя.
const BUTTON_QUIET =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-text-primary-dark/15 text-sm font-semibold text-text-primary-dark transition-colors hover:bg-text-primary-dark/25 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary-dark/80 disabled:pointer-events-none disabled:opacity-40';
</script>

<template>
  <!-- -mx-2.5: плашка в 10 px от края экрана, шире ленты — читается слоем над ней, а не строкой.
       @container: на 360 px «все» с кнопки уходит, иначе итог обрезается -->
  <div data-testid="bulk-dock" class="@container -mx-2.5 pt-2 pb-2.5">
    <div
      class="flex items-center gap-2 rounded-2xl bg-text-primary-light py-2.5 pr-2 pl-3.5 text-text-primary-dark shadow-lg dark:bg-surface-dark"
    >
      <!-- Высота колонки зафиксирована: скелетон и итог занимают одно и то же место -->
      <div
        class="flex min-h-11 min-w-0 flex-1 flex-col justify-center"
        :aria-busy="!summary || undefined"
      >
        <template v-if="summary">
          <span class="truncate text-xs leading-4 text-text-secondary-dark">{{ label }}</span>
          <span
            data-testid="bulk-dock-total"
            :class="
              cn(
                'truncate text-body-lg leading-6 font-semibold tabular-nums transition-opacity',
                stale && 'opacity-60',
              )
            "
          >
            {{ total }}
          </span>
        </template>
        <template v-else>
          <span class="flex h-4 items-center" aria-hidden="true">
            <span
              class="h-3 w-28 animate-pulse rounded bg-text-primary-dark/15 motion-reduce:animate-none"
            />
          </span>
          <span class="flex h-6 items-center" aria-hidden="true">
            <span
              class="h-4 w-36 animate-pulse rounded bg-text-primary-dark/15 motion-reduce:animate-none"
            />
          </span>
        </template>
      </div>

      <template v-if="showEditAll">
        <button
          type="button"
          data-testid="bulk-select-btn"
          aria-label="Выбрать вручную"
          :disabled="selectDisabled"
          :class="cn(BUTTON_QUIET, 'w-11')"
          @click="$emit('select')"
        >
          <UIcon name="checklist" size="md" />
        </button>
        <UButton
          type="button"
          size="lg"
          class="!px-3"
          data-testid="bulk-edit-all-btn"
          aria-haspopup="dialog"
          :disabled="stale"
          @click="$emit('editAll')"
        >
          <span>
            Изменить
            <span class="hidden @[22rem]:inline">все</span>
            {{ eligibleCount }}
          </span>
        </UButton>
      </template>
      <button
        v-else
        type="button"
        data-testid="bulk-select-btn"
        :disabled="selectBlocked"
        :class="cn(BUTTON_QUIET, 'px-4')"
        @click="$emit('select')"
      >
        <UIcon name="checklist" size="sm" />
        Выбрать
      </button>
    </div>
  </div>
</template>
