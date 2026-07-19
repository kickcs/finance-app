<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { UCard, Skeleton } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { toLocalISODate } from '@/shared/lib/date';
import type { SpendingPaceEntry } from '../types';

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

// Y-axis ceiling with headroom (accounts for projected total so the forecast line fits)
const ceil = computed(() => {
  if (!hasEntries.value) return 1;
  const peak = Math.max(...props.entries.map((e) => e.actual), projection.value ?? 0, 0);
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

// --- Projection: total spend at the current pace by the end of the period.
// Only meaningful mid-period (for past periods lastEntry.day reaches totalDays).
const projection = computed(() => {
  const last = lastEntry.value;
  if (!last || last.day <= 0 || last.day >= props.totalDays || last.actual <= 0) return null;
  return (last.actual / last.day) * props.totalDays;
});

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

// Projection turns red when the pace leads past the budget
const projColor = computed(() =>
  hasBudget.value && projection.value !== null && projection.value > props.budgetAmount
    ? 'var(--color-danger)'
    : color.value,
);

const projPath = computed(() => {
  const last = lastEntry.value;
  if (projection.value === null || !last) return '';
  return `M${sx(last.day)},${sy(last.actual)} L${sx(props.totalDays)},${sy(projection.value)}`;
});

// Endpoint label; dodges the "Бюджет" caption and the top edge
const projLabel = computed(() => {
  if (projection.value === null) return null;
  const pointY = sy(projection.value);
  let y = pointY - 8;
  const budgetLabelY = hasBudget.value ? sy(props.budgetAmount) - 5 : null;
  if (y < P.t + 10 || (budgetLabelY !== null && Math.abs(y - budgetLabelY) < 12)) {
    y = pointY + 14;
  }
  return {
    x: sx(props.totalDays) - 7,
    y,
    pointY,
    text: `≈ ${formatCurrency(projection.value, props.currency, COMPACT_FORMAT)}`,
  };
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

// Buffered entry: retains last active entry so text doesn't vanish during transitions
const displayEntry = ref<SpendingPaceEntry | null>(null);
watch(activeEntry, (entry) => {
  if (entry) displayEntry.value = entry;
});

let cachedRect: DOMRect | null = null;

function handlePointerMove(evt: PointerEvent) {
  const svg = evt.currentTarget as SVGSVGElement;
  if (!cachedRect) cachedRect = svg.getBoundingClientRect();
  const svgX = ((evt.clientX - cachedRect.left) / cachedRect.width) * W;

  let closest = -1;
  let minDist = Infinity;
  for (let i = 0; i < props.entries.length; i++) {
    const dist = Math.abs(sx(props.entries[i].day) - svgX);
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }

  if (closest >= 0) {
    activeIdx.value = closest;
  }
}

function handlePointerLeave() {
  activeIdx.value = null;
  cachedRect = null;
}

// Budget % for tooltip
const displayBudgetPercent = computed(() => {
  if (!displayEntry.value || !hasBudget.value) return null;
  return ((displayEntry.value.actual / props.budgetAmount) * 100).toFixed(1);
});

// X-axis label step
const labelStep = computed(() => {
  const n = props.totalDays;
  if (n <= 10) return 1;
  if (n <= 15) return 2;
  if (n <= 31) return 5;
  return 7;
});

// Format ISO date string as short label (e.g. "5 мая")
function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return formatDate(new Date(y, m - 1, d), { format: 'short' });
}

// Compute ISO date string for any day number in the period
function dateForDay(dayNum: number): string {
  if (!hasEntries.value) return '';
  const first = props.entries[0];
  const [y, m, d] = first.date.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + (dayNum - first.day));
  return toLocalISODate(base);
}

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
  <UCard class="p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
        Темп расходов
      </h3>
      <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
        {{ periodLabel }}
      </span>
    </div>

    <!-- Legend -->
    <div v-if="!loading && hasEntries" class="flex items-center gap-4 mb-2">
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
      <div v-if="projection !== null" class="flex items-center gap-1.5">
        <svg width="20" height="2" class="shrink-0">
          <line
            x1="0"
            y1="1"
            x2="20"
            y2="1"
            :stroke="projColor"
            stroke-dasharray="2 4"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">Прогноз</span>
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
      <!-- SVG -->
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        class="w-full cursor-pointer"
        preserveAspectRatio="xMidYMid meet"
        @pointermove="handlePointerMove"
        @pointerleave="handlePointerLeave"
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
              style="font-size: 10px"
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
              style="font-size: 10px; font-weight: 500"
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
            stroke-width="1.8"
            class="stroke-text-tertiary-light dark:stroke-text-tertiary-dark"
            opacity="0.5"
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

          <!-- Projection line: current pace extended to the end of the period -->
          <template v-if="projPath && projLabel">
            <path
              :d="projPath"
              fill="none"
              :stroke="projColor"
              stroke-width="1.8"
              stroke-dasharray="2 4"
              stroke-linecap="round"
              opacity="0.85"
            />
            <circle
              :cx="sx(totalDays)"
              :cy="projLabel.pointY"
              r="3"
              :fill="projColor"
              class="stroke-card-light dark:stroke-card-dark"
              stroke-width="1.5"
            />
            <text
              :x="projLabel.x"
              :y="projLabel.y"
              text-anchor="end"
              :fill="projColor"
              style="font-size: 10px; font-weight: 600"
            >
              {{ projLabel.text }}
            </text>
          </template>

          <!-- Today vertical marker -->
          <line
            v-if="todayX !== null"
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

          <!-- X-axis date labels -->
          <template v-for="d in totalDays" :key="d">
            <text
              v-if="d === 1 || d === totalDays || (d % labelStep === 0 && d < totalDays - 1)"
              :x="sx(d)"
              :y="H - 6"
              text-anchor="middle"
              class="fill-text-tertiary-light dark:fill-text-tertiary-dark"
              style="font-size: 10px"
            >
              {{ formatDayLabel(dateForDay(d)) }}
            </text>
          </template>
        </g>
      </svg>

      <!-- Tooltip (fixed below chart) -->
      <div
        class="relative mt-2 bg-surface-light dark:bg-surface-dark rounded-lg text-sm h-[32px] overflow-hidden"
      >
        <!-- Active entry data (uses displayEntry for stable text, activeEntry for visibility) -->
        <div
          class="absolute inset-0 px-3 py-1.5 flex items-center gap-2 transition-opacity duration-150 ease-out"
          :class="activeEntry ? 'opacity-100' : 'opacity-0'"
        >
          <span class="text-text-secondary-light dark:text-text-secondary-dark whitespace-nowrap">
            {{ displayEntry ? formatDayLabel(displayEntry.date) : '' }}
          </span>
          <span
            class="font-semibold text-text-primary-light dark:text-text-primary-dark whitespace-nowrap"
          >
            {{ displayEntry ? formatCurrency(displayEntry.actual, currency, COMPACT_FORMAT) : '' }}
          </span>
          <span
            v-if="hasBudget"
            class="text-text-tertiary-light dark:text-text-tertiary-dark whitespace-nowrap"
          >
            {{
              displayEntry
                ? `/ ${formatCurrency(displayEntry.ideal, currency, COMPACT_FORMAT)}`
                : ''
            }}
          </span>
          <span
            v-if="hasBudget && displayBudgetPercent !== null"
            class="text-xs font-medium whitespace-nowrap"
            :style="{ color: color }"
          >
            · {{ displayBudgetPercent }}%
          </span>
        </div>
        <!-- Placeholder -->
        <div
          class="absolute inset-0 px-3 py-1.5 flex items-center transition-opacity duration-150 ease-out"
          :class="activeEntry ? 'opacity-0' : 'opacity-100'"
        >
          <span class="text-text-tertiary-light dark:text-text-tertiary-dark">
            Нажмите на точку графика
          </span>
        </div>
      </div>

      <!-- Status summary -->
      <div
        v-if="hasBudget || projection !== null"
        class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1"
      >
        <template v-if="hasBudget">
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
        </template>
        <span
          v-if="projection !== null"
          class="text-sm text-text-secondary-light dark:text-text-secondary-dark whitespace-nowrap"
        >
          <template v-if="hasBudget">·&nbsp;</template>
          К концу периода:
          <span class="font-medium" :style="{ color: projColor }">
            ≈ {{ formatCurrency(projection, currency, COMPACT_FORMAT) }}
          </span>
        </span>
      </div>
    </template>
  </UCard>
</template>
