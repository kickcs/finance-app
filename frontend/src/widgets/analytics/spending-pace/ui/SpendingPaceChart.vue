<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { UCard, Skeleton } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';

export interface SpendingPaceEntry {
  day: number;
  actual: number;
  ideal: number;
  date: string;
}

const props = withDefaults(
  defineProps<{
    entries: SpendingPaceEntry[];
    budgetAmount: number;
    totalDays: number;
    todayIndex: number;
    currency: string;
    periodLabel: string;
    loading?: boolean;
  }>(),
  { loading: false },
);

// Reveal animation
const animated = ref(false);
useTimeoutFn(() => {
  animated.value = true;
}, 150);

// Active point (hover/tap)
const activeIdx = ref<number | null>(null);

// --- Layout ---
const W = 400;
const H = 190;
const P = { t: 8, r: 8, b: 32, l: 48 };
const cw = W - P.l - P.r;
const ch = H - P.t - P.b;

const hasEntries = computed(() => props.entries.length > 0);
const hasBudget = computed(() => props.budgetAmount > 0);

// Y-axis ceiling with headroom
const ceil = computed(() => {
  if (!hasEntries.value) return 1;
  const peak = Math.max(...props.entries.map((e) => e.actual), 0);
  if (hasBudget.value) return Math.max(props.budgetAmount, peak) * 1.12 || 1;
  return peak * 1.2 || 1;
});

// Scale helpers
function sx(dayNum: number): number {
  return P.l + (dayNum / Math.max(props.totalDays, 1)) * cw;
}

function sy(v: number): number {
  return P.t + ch - (v / ceil.value) * ch;
}

// --- Paths ---
const idealPath = computed(() => {
  if (!hasBudget.value) return '';
  return `M${sx(0)},${sy(0)} L${sx(props.totalDays)},${sy(props.budgetAmount)}`;
});

const line = computed(() => {
  if (!hasEntries.value) return '';
  return (
    `M${sx(0)},${sy(0)} ` + props.entries.map((e) => `L${sx(e.day)},${sy(e.actual)}`).join(' ')
  );
});

const area = computed(() => {
  if (!hasEntries.value) return '';
  const last = props.entries[props.entries.length - 1];
  const base = sy(0);
  return `${line.value} L${sx(last.day)},${base} L${sx(0)},${base} Z`;
});

// Today vertical marker
const todayX = computed(() => {
  if (props.todayIndex < 0 || props.todayIndex >= props.totalDays) return null;
  return sx(props.todayIndex + 1);
});

// Last data point (used by multiple computeds)
const lastEntry = computed(() =>
  hasEntries.value ? props.entries[props.entries.length - 1] : null,
);

// --- Zone coloring ---
const ratio = computed(() => {
  if (!lastEntry.value || !hasBudget.value) return 0;
  return lastEntry.value.ideal > 0 ? lastEntry.value.actual / lastEntry.value.ideal : 0;
});

type Zone = 'success' | 'warning' | 'danger';
const zone = computed<Zone>(() => {
  if (ratio.value <= 0.8) return 'success';
  if (ratio.value <= 1.0) return 'warning';
  return 'danger';
});

const color = computed(() => {
  if (!hasBudget.value) return 'var(--color-primary)';
  return {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)',
  }[zone.value];
});

// --- Deviation summary ---
const deviation = computed(() => {
  if (!lastEntry.value || !hasBudget.value) return 0;
  return Math.abs(lastEntry.value.actual - lastEntry.value.ideal);
});

// --- Tooltip ---
const activeEntry = computed(() =>
  activeIdx.value !== null ? (props.entries[activeIdx.value] ?? null) : null,
);

function toggleDay(i: number) {
  activeIdx.value = activeIdx.value === i ? null : i;
}

// Hit zone width per day
const hitW = computed(() => cw / Math.max(props.totalDays, 1));

// X-axis label step
const labelStep = computed(() => {
  const n = props.totalDays;
  if (n <= 10) return 1;
  if (n <= 15) return 2;
  if (n <= 31) return 5;
  return 7;
});

// Y-axis ticks: 0 and 50% of budget (100% handled by dedicated budget line)
const Y_AXIS_FORMAT = { compact: true, showSymbol: false } as const;
const yTicks = computed(() => {
  const max = ceil.value;
  const steps = hasBudget.value ? [0, props.budgetAmount * 0.5] : [0, max * 0.5, max];
  return steps.map((v) => ({
    y: sy(v),
    label: formatCurrency(v, props.currency, Y_AXIS_FORMAT),
  }));
});
</script>

<template>
  <UCard class="p-5">
    <!-- Header -->
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
        Темп расходов
      </h3>
      <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
        {{ periodLabel }}
      </span>
    </div>

    <!-- Legend -->
    <div v-if="!loading && hasEntries" class="flex items-center gap-4 mb-3">
      <div v-if="hasBudget" class="flex items-center gap-1.5">
        <svg width="20" height="2" class="shrink-0">
          <line
            x1="0"
            y1="1"
            x2="20"
            y2="1"
            stroke-dasharray="4 3"
            stroke-width="1.5"
            class="stroke-text-tertiary-light dark:stroke-text-tertiary-dark"
            opacity="0.5"
          />
        </svg>
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">План</span>
      </div>
      <div class="flex items-center gap-1.5">
        <svg width="20" height="2" class="shrink-0">
          <line
            x1="0"
            y1="1"
            x2="20"
            y2="1"
            :stroke="color"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">Факт</span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <Skeleton class="h-[160px] rounded-lg" />
      <div class="flex items-center gap-2">
        <Skeleton class="w-2.5 h-2.5 rounded-full" />
        <Skeleton class="h-4 w-44 rounded" />
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!hasEntries"
      class="h-[160px] flex items-center justify-center text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      Нет данных о расходах
    </div>

    <!-- Chart -->
    <template v-else>
      <!-- Tooltip -->
      <div
        v-if="activeEntry"
        class="mb-2 px-3 py-1.5 bg-surface-light dark:bg-surface-dark rounded-lg inline-flex items-center gap-2 text-sm"
      >
        <span class="text-text-secondary-light dark:text-text-secondary-dark">
          День {{ activeEntry.day }}
        </span>
        <span class="font-semibold text-text-primary-light dark:text-text-primary-dark">
          {{ formatCurrency(activeEntry.actual, currency, COMPACT_FORMAT) }}
        </span>
        <span v-if="hasBudget" class="text-text-tertiary-light dark:text-text-tertiary-dark">
          / {{ formatCurrency(activeEntry.ideal, currency, COMPACT_FORMAT) }}
        </span>
      </div>

      <!-- SVG -->
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        class="w-full"
        preserveAspectRatio="xMidYMid meet"
        @pointerleave="activeIdx = null"
      >
        <defs>
          <linearGradient id="spending-pace-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="color" stop-opacity="0.22" />
            <stop offset="100%" :stop-color="color" stop-opacity="0.02" />
          </linearGradient>
        </defs>

        <g
          class="transition-opacity duration-700 ease-out"
          :class="animated ? 'opacity-100' : 'opacity-0'"
        >
          <!-- Y-axis labels + horizontal grid lines -->
          <template v-for="(tick, ti) in yTicks" :key="ti">
            <line
              v-if="ti > 0"
              :x1="P.l"
              :y1="tick.y"
              :x2="W - P.r"
              :y2="tick.y"
              stroke-dasharray="4 3"
              class="stroke-border-light dark:stroke-border-dark"
              stroke-width="1"
              opacity="0.5"
            />
            <text
              :x="P.l - 6"
              :y="tick.y + 3"
              text-anchor="end"
              class="fill-text-tertiary-light dark:fill-text-tertiary-dark"
              style="font-size: 9px"
            >
              {{ tick.label }}
            </text>
          </template>

          <!-- Budget boundary line -->
          <template v-if="hasBudget">
            <line
              :x1="P.l"
              :y1="sy(budgetAmount)"
              :x2="W - P.r"
              :y2="sy(budgetAmount)"
              stroke-dasharray="6 3"
              class="stroke-warning"
              stroke-width="1"
              opacity="0.6"
            />
            <text
              :x="W - P.r"
              :y="sy(budgetAmount) - 5"
              text-anchor="end"
              class="fill-warning"
              style="font-size: 9px; font-weight: 500"
            >
              Бюджет
            </text>
          </template>

          <!-- Ideal pace line (diagonal dashed) -->
          <path
            v-if="idealPath"
            :d="idealPath"
            fill="none"
            stroke-dasharray="6 4"
            stroke-width="1.5"
            class="stroke-text-tertiary-light dark:stroke-text-tertiary-dark"
            opacity="0.35"
          />

          <!-- Actual area fill -->
          <path :d="area" fill="url(#spending-pace-fill)" />

          <!-- Actual spending line -->
          <path
            :d="line"
            fill="none"
            :stroke="color"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- Today vertical marker -->
          <line
            v-if="todayX != null"
            :x1="todayX"
            :y1="P.t"
            :x2="todayX"
            :y2="P.t + ch"
            stroke-dasharray="3 3"
            :stroke="color"
            stroke-width="1"
            opacity="0.4"
          />

          <!-- Active point indicator -->
          <circle
            v-if="activeEntry"
            :cx="sx(activeEntry.day)"
            :cy="sy(activeEntry.actual)"
            r="4"
            :fill="color"
            class="stroke-card-light dark:stroke-card-dark"
            stroke-width="2"
          />

          <!-- Touch/hover zones -->
          <rect
            v-for="(e, i) in entries"
            :key="e.day"
            :x="sx(e.day) - hitW / 2"
            :y="P.t"
            :width="hitW"
            :height="ch"
            fill="transparent"
            class="cursor-pointer"
            @pointerenter="activeIdx = i"
            @click="toggleDay(i)"
          />

          <!-- X-axis day labels -->
          <template v-for="d in totalDays" :key="d">
            <text
              v-if="d === 1 || d === totalDays || (d % labelStep === 0 && d < totalDays - 1)"
              :x="sx(d)"
              :y="H - 12"
              text-anchor="middle"
              class="fill-text-tertiary-light dark:fill-text-tertiary-dark"
              style="font-size: 10px"
            >
              {{ d }}
            </text>
          </template>

          <!-- X-axis title -->
          <text
            :x="P.l + cw / 2"
            :y="H - 1"
            text-anchor="middle"
            class="fill-text-tertiary-light dark:fill-text-tertiary-dark"
            style="font-size: 9px"
          >
            Дни периода
          </text>
        </g>
      </svg>

      <!-- Status summary -->
      <div v-if="hasBudget" class="mt-2 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: color }" />
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          <template v-if="deviation < 1">Точно по плану</template>
          <template v-else-if="ratio > 1">
            На
            <span class="font-medium text-danger">
              {{ formatCurrency(deviation, currency, COMPACT_FORMAT) }}
            </span>
            больше идеала
          </template>
          <template v-else>
            На
            <span class="font-medium text-success">
              {{ formatCurrency(deviation, currency, COMPACT_FORMAT) }}
            </span>
            меньше идеала
          </template>
        </span>
      </div>
    </template>
  </UCard>
</template>
