<script setup lang="ts">
import { computed, ref } from 'vue';
import { UCard, Skeleton } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';
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

const title = computed(() => {
  switch (props.groupBy) {
    case 'week':
      return 'Расходы по неделям';
    case 'month':
      return 'Расходы по месяцам';
    default:
      return 'Расходы по дням';
  }
});

const maxExpense = computed(() => {
  const max = Math.max(...props.entries.map((e) => e.expense), 0);
  return max || 1;
});

const hasData = computed(() => props.entries.some((e) => e.expense > 0));

// Chart dimensions
const BAR_GAP = 2;
const BAR_MIN_WIDTH = 8;
const CHART_HEIGHT = 140;
const LABEL_HEIGHT = 20;

const barWidth = computed(() => {
  const count = props.entries.length || 1;
  const totalWidth = Math.max(count * (BAR_MIN_WIDTH + BAR_GAP), 280);
  return (totalWidth - BAR_GAP * count) / count;
});

const chartWidth = computed(() => {
  const count = props.entries.length || 1;
  return count * (barWidth.value + BAR_GAP);
});

function barHeight(expense: number): number {
  if (expense <= 0) return 0;
  return (expense / maxExpense.value) * CHART_HEIGHT;
}

function barX(index: number): number {
  return index * (barWidth.value + BAR_GAP);
}

function formatLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (props.groupBy === 'month') {
    return date.toLocaleDateString('ru-RU', { month: 'short' });
  }
  return `${date.getDate()}`;
}

// Show every Nth label to avoid crowding
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
</script>

<template>
  <UCard class="p-5">
    <h3 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
      {{ title }}
    </h3>

    <!-- Loading skeleton -->
    <div v-if="loading" class="flex items-end gap-1 h-[160px]">
      <Skeleton
        v-for="(h, i) in skeletonHeights"
        :key="i"
        class="flex-1 rounded-t"
        :style="{ height: `${h}%` }"
      />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!hasData"
      class="h-[160px] flex items-center justify-center text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      Нет расходов за период
    </div>

    <!-- Chart -->
    <template v-else>
      <!-- Tooltip -->
      <div
        v-if="selectedEntry"
        class="mb-2 px-3 py-1.5 bg-surface-light dark:bg-surface-dark rounded-lg inline-flex items-center gap-2 text-sm"
      >
        <span class="text-text-secondary-light dark:text-text-secondary-dark">
          {{ formatTooltipDate(selectedEntry.date) }}
        </span>
        <span class="font-semibold text-text-primary-light dark:text-text-primary-dark">
          {{ formatCurrency(selectedEntry.expense, currency, COMPACT_FORMAT) }}
        </span>
      </div>

      <div class="overflow-x-auto -mx-1 px-1">
        <svg
          :width="chartWidth"
          :height="CHART_HEIGHT + LABEL_HEIGHT"
          :viewBox="`0 0 ${chartWidth} ${CHART_HEIGHT + LABEL_HEIGHT}`"
          class="w-full"
          :style="{ minWidth: `${Math.min(chartWidth, 280)}px` }"
        >
          <g v-for="(entry, i) in entries" :key="entry.date">
            <!-- Bar -->
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

            <!-- X-axis labels -->
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
  </UCard>
</template>
