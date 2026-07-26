<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue';
import { useElementSize } from '@vueuse/core';
import { Skeleton } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT, COMPACT_BARE_FORMAT } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';

const props = withDefaults(
  defineProps<{
    entries: { date: string; expense: number }[];
    currency: string;
    loading?: boolean;
    groupBy?: 'day' | 'week' | 'month';
  }>(),
  {
    groupBy: 'day',
  },
);

const selectedIndex = ref<number | null>(null);

const skeletonHeights = [35, 65, 50, 80, 45, 70, 30];

const maxExpense = computed(() => {
  const max = Math.max(...props.entries.map((e) => e.expense), 0);
  return max || 1;
});

const hasData = computed(() => props.entries.some((e) => e.expense > 0));

const BAR_GAP = 2;
const CHART_HEIGHT = 140;
const LABEL_HEIGHT = 20;
const Y_AXIS_WIDTH = 36;
/** Ширина до первого замера ResizeObserver — иначе первый кадр рисуется нулевыми столбцами. */
const FALLBACK_WIDTH = 300;

const chartHost = useTemplateRef<HTMLElement>('chartHost');
const { width: hostWidth } = useElementSize(chartHost);

/**
 * Ширина берётся у контейнера, а не у константы. Прежний расчёт исходил из
 * минимума в 280px и при 31 дне давал 357px против ~318px доступных, из-за чего
 * график уезжал в горизонтальный скролл.
 */
const chartWidth = computed(() => (hostWidth.value > 0 ? hostWidth.value : FALLBACK_WIDTH));

const barWidth = computed(() => {
  const count = props.entries.length || 1;
  const usable = chartWidth.value - Y_AXIS_WIDTH - BAR_GAP * count;
  return Math.max(1, usable / count);
});

function barHeight(expense: number): number {
  if (expense <= 0) return 0;
  return (expense / maxExpense.value) * CHART_HEIGHT;
}

function barX(index: number): number {
  return Y_AXIS_WIDTH + index * (barWidth.value + BAR_GAP);
}

function formatLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (props.groupBy === 'month') {
    return date.toLocaleDateString('ru-RU', { month: 'short' });
  }
  return `${date.getDate()}`;
}

/** Показываем каждую N-ю подпись, чтобы они не сливались на узком экране. */
const labelStep = computed(() => {
  const count = props.entries.length;
  if (count <= 7) return 1;
  if (count <= 14) return 2;
  if (count <= 31) return 5;
  return 7;
});

function handleBarClick(index: number) {
  selectedIndex.value = selectedIndex.value === index ? null : index;
}

const selectedEntry = computed(() => {
  if (selectedIndex.value === null) return null;
  return props.entries[selectedIndex.value] ?? null;
});

function formatTooltipDate(dateStr: string): string {
  return formatDate(dateStr + 'T00:00:00', { format: 'short' });
}

const yTicks = computed(() => {
  const max = maxExpense.value;
  if (max <= 1) return [];
  const mid = max / 2;
  return [
    {
      value: mid,
      y: CHART_HEIGHT - (mid / max) * CHART_HEIGHT,
      label: formatCurrency(mid, props.currency, COMPACT_BARE_FORMAT),
    },
    { value: max, y: 4, label: formatCurrency(max, props.currency, COMPACT_BARE_FORMAT) },
  ];
});
</script>

<template>
  <div>
    <div v-if="loading" class="flex items-end gap-1 h-[160px]">
      <Skeleton
        v-for="(h, i) in skeletonHeights"
        :key="i"
        class="flex-1 rounded-t"
        :style="{ height: `${h}%` }"
      />
    </div>

    <div
      v-else-if="!hasData"
      class="h-[160px] flex items-center justify-center text-body-sm text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      Нет расходов за период
    </div>

    <template v-else>
      <!-- Место под подсказку зарезервировано всегда: иначе выбор столбца
           сдвигал бы график вниз и давал скачок вёрстки. -->
      <div class="h-7 mb-1">
        <div
          v-if="selectedEntry"
          class="px-2.5 py-1 bg-surface-light dark:bg-surface-dark rounded-lg inline-flex items-center gap-2 text-body-sm"
        >
          <span class="text-text-secondary-light dark:text-text-secondary-dark">
            {{ formatTooltipDate(selectedEntry.date) }}
          </span>
          <span
            class="font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark"
          >
            {{ formatCurrency(selectedEntry.expense, currency, COMPACT_FORMAT) }}
          </span>
        </div>
      </div>

      <div ref="chartHost" class="w-full">
        <svg
          :width="chartWidth"
          :height="CHART_HEIGHT + LABEL_HEIGHT"
          :viewBox="`0 0 ${chartWidth} ${CHART_HEIGHT + LABEL_HEIGHT}`"
          class="w-full block"
        >
          <template v-for="tick in yTicks" :key="tick.value">
            <line
              :x1="Y_AXIS_WIDTH"
              :y1="tick.y"
              :x2="chartWidth"
              :y2="tick.y"
              stroke-dasharray="4 3"
              class="stroke-border-light dark:stroke-border-dark"
              stroke-width="1"
              opacity="0.4"
            />
            <text
              :x="Y_AXIS_WIDTH - 4"
              :y="tick.y + 3"
              text-anchor="end"
              class="fill-text-tertiary-light dark:fill-text-tertiary-dark"
              style="font-size: 10px"
            >
              {{ tick.label }}
            </text>
          </template>

          <g v-for="(entry, i) in entries" :key="entry.date">
            <rect
              :x="barX(i)"
              :y="CHART_HEIGHT - barHeight(entry.expense)"
              :width="barWidth"
              :height="Math.max(barHeight(entry.expense), entry.expense > 0 ? 2 : 0)"
              :rx="Math.min(barWidth / 2, 3)"
              class="cursor-pointer transition-opacity duration-200"
              :class="
                selectedIndex === i ? 'fill-primary' : 'fill-primary/60 hover:fill-primary/80'
              "
              @click="handleBarClick(i)"
            />

            <text
              v-if="i % labelStep === 0"
              :x="barX(i) + barWidth / 2"
              :y="CHART_HEIGHT + 14"
              text-anchor="middle"
              class="fill-text-tertiary-light dark:fill-text-tertiary-dark"
              style="font-size: 10px"
            >
              {{ formatLabel(entry.date) }}
            </text>
          </g>
        </svg>
      </div>
    </template>
  </div>
</template>
