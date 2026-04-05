# Analytics Period Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use the **frontend-design** skill when implementing UI components (Tasks 3, 6).

**Goal:** Replace the analytics page time filtering with Apple Health-style swipeable period navigation (Day/Month/Year), a single scrollable content flow, and prefetch for instant transitions.

**Architecture:** New `usePeriodNavigation()` composable handles scale/offset/dateRange logic. New `SwipeablePeriodHeader.vue` handles touch, arrows, haptics, and "Today" button. AnalyticsPage is rewritten to use these and render a single scrollable widget stream instead of 3 section tabs. Prefetch via `queryClient.prefetchQuery()`.

**Tech Stack:** Vue 3 Composition API, TypeScript, TanStack Vue Query, Tailwind CSS v4, VueUse, web-haptics

**Spec:** `docs/superpowers/specs/2026-04-03-analytics-period-navigation-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| CREATE | `features/analytics-filters/model/usePeriodNavigation.ts` | Scale/offset state, dateRange computation, navigation methods, comparison range |
| CREATE | `features/analytics-filters/model/usePeriodNavigation.spec.ts` | Unit tests for period navigation logic |
| CREATE | `features/analytics-filters/ui/SwipeablePeriodHeader.vue` | Touch swipe, arrow buttons, "Today" button, mini-comparison badge, haptics |
| MODIFY | `features/analytics-filters/model/types.ts` | Add `PeriodScale`, keep `CategoryStat`, remove `LitePeriod`/`DateRange`/`AnalyticsFilters` |
| MODIFY | `features/analytics-filters/model/useAnalyticsFilters.ts` | Strip to account-only filters |
| MODIFY | `features/analytics-filters/model/useAnalyticsFilters.spec.ts` | Update tests for simplified composable |
| MODIFY | `features/analytics-filters/index.ts` | Update exports |
| REWRITE | `pages/analytics/AnalyticsPage.vue` | Single flow, SwipeablePeriodHeader, Transition, prefetch |
| DELETE | `features/analytics-filters/ui/DateRangePicker.vue` | No longer needed |

All paths relative to `frontend/src/`.

---

## Task 1: Update types.ts

**Files:**
- Modify: `frontend/src/features/analytics-filters/model/types.ts`

- [ ] **Step 1: Replace types.ts content**

```typescript
// frontend/src/features/analytics-filters/model/types.ts

export type PeriodScale = 'day' | 'month' | 'year';

export type TransactionType = 'all' | 'expense' | 'income';

export interface AccountFilters {
  selectedAccountIds: string[];
}

export interface CategoryStat {
  id: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  percent: number;
}
```

- [ ] **Step 2: Verify no compile errors**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | head -30`

Expected: Errors in files that import `LitePeriod`, `DateRange`, `AnalyticsFilters` — these will be fixed in subsequent tasks.

---

## Task 2: Create usePeriodNavigation composable

**Files:**
- Create: `frontend/src/features/analytics-filters/model/usePeriodNavigation.ts`
- Create: `frontend/src/features/analytics-filters/model/usePeriodNavigation.spec.ts`

- [ ] **Step 1: Write tests for usePeriodNavigation**

```typescript
// frontend/src/features/analytics-filters/model/usePeriodNavigation.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';

// Mock useFinancialPeriod before import
vi.mock('@/shared/lib/hooks/useFinancialPeriod', () => ({
  useFinancialPeriod: () => ({
    startDay: ref(1),
    isCustomPeriod: ref(false),
    currentPeriod: ref({ year: 2026, month: 4 }),
    currentBounds: ref({
      start: new Date(2026, 3, 1),  // Apr 1 2026
      end: new Date(2026, 4, 1),    // May 1 2026 (exclusive)
    }),
    totalDays: ref(30),
    daysRemaining: ref(15),
  }),
}));

import { usePeriodNavigation } from './usePeriodNavigation';

describe('usePeriodNavigation', () => {
  let nav: ReturnType<typeof usePeriodNavigation>;

  beforeEach(() => {
    // Fix "today" for predictable tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 3)); // Apr 3 2026
    nav = usePeriodNavigation();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Initial state ---
  describe('initial state', () => {
    it('defaults to month scale', () => {
      expect(nav.scale.value).toBe('month');
    });

    it('defaults to offset 0 (current period)', () => {
      expect(nav.offset.value).toBe(0);
    });

    it('isCurrentPeriod is true at offset 0', () => {
      expect(nav.isCurrentPeriod.value).toBe(true);
    });

    it('canGoNext is false at offset 0', () => {
      expect(nav.canGoNext.value).toBe(false);
    });

    it('canGoPrev is true', () => {
      expect(nav.canGoPrev.value).toBe(true);
    });
  });

  // --- Month scale navigation ---
  describe('month scale', () => {
    it('label shows current month name', () => {
      expect(nav.label.value).toContain('Апрель');
      expect(nav.label.value).toContain('2026');
    });

    it('dateRange covers current financial month', () => {
      const { startDate, endDate } = nav.dateRange.value;
      expect(startDate).toBe('2026-04-01');
      // endDate should be today for current period
      expect(endDate).toBe('2026-04-03');
    });

    it('prev() decreases offset and updates range', () => {
      nav.prev();
      expect(nav.offset.value).toBe(-1);
      expect(nav.isCurrentPeriod.value).toBe(false);
      expect(nav.canGoNext.value).toBe(true);
      // March
      expect(nav.label.value).toContain('Март');
    });

    it('prev() month shows full month range (not up to today)', () => {
      nav.prev();
      const { startDate, endDate } = nav.dateRange.value;
      expect(startDate).toBe('2026-03-01');
      expect(endDate).toBe('2026-03-31');
    });

    it('next() at offset 0 does nothing', () => {
      nav.next();
      expect(nav.offset.value).toBe(0);
    });

    it('next() from offset -1 goes back to 0', () => {
      nav.prev();
      nav.next();
      expect(nav.offset.value).toBe(0);
      expect(nav.isCurrentPeriod.value).toBe(true);
    });

    it('goToday resets offset to 0', () => {
      nav.prev();
      nav.prev();
      nav.goToday();
      expect(nav.offset.value).toBe(0);
    });
  });

  // --- Day scale ---
  describe('day scale', () => {
    beforeEach(() => {
      nav.setScale('day');
    });

    it('resets offset to 0 on scale change', () => {
      nav.prev(); // offset -1 on month
      nav.setScale('day');
      expect(nav.offset.value).toBe(0);
    });

    it('label shows today formatted', () => {
      // Apr 3 2026 should show day + weekday
      expect(nav.label.value).toMatch(/3/);
      expect(nav.label.value).toMatch(/апрел/i);
    });

    it('dateRange is a single day', () => {
      const { startDate, endDate } = nav.dateRange.value;
      expect(startDate).toBe('2026-04-03');
      expect(endDate).toBe('2026-04-03');
    });

    it('prev() goes to yesterday', () => {
      nav.prev();
      const { startDate, endDate } = nav.dateRange.value;
      expect(startDate).toBe('2026-04-02');
      expect(endDate).toBe('2026-04-02');
    });

    it('daysInPeriod is 1 for day scale', () => {
      expect(nav.daysInPeriod.value).toBe(1);
    });
  });

  // --- Year scale ---
  describe('year scale', () => {
    beforeEach(() => {
      nav.setScale('year');
    });

    it('label shows year', () => {
      expect(nav.label.value).toBe('2026');
    });

    it('dateRange covers Jan 1 to today for current year', () => {
      const { startDate, endDate } = nav.dateRange.value;
      expect(startDate).toBe('2026-01-01');
      expect(endDate).toBe('2026-04-03');
    });

    it('prev year shows full year range', () => {
      nav.prev();
      const { startDate, endDate } = nav.dateRange.value;
      expect(startDate).toBe('2025-01-01');
      expect(endDate).toBe('2025-12-31');
    });
  });

  // --- Comparison range ---
  describe('comparisonDateRange', () => {
    it('returns previous month range for month scale', () => {
      const { startDate, endDate } = nav.comparisonDateRange.value;
      expect(startDate).toBe('2026-03-01');
      expect(endDate).toBe('2026-03-31');
    });

    it('returns previous day for day scale', () => {
      nav.setScale('day');
      const { startDate, endDate } = nav.comparisonDateRange.value;
      expect(startDate).toBe('2026-04-02');
      expect(endDate).toBe('2026-04-02');
    });
  });

  // --- Sublabel ---
  describe('sublabel', () => {
    it('shows date range and day count for month', () => {
      expect(nav.sublabel.value).toMatch(/1 апр/);
      expect(nav.sublabel.value).toMatch(/3 апр/);
      expect(nav.sublabel.value).toMatch(/дн/);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/analytics-filters/model/usePeriodNavigation.spec.ts 2>&1 | tail -20`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement usePeriodNavigation**

```typescript
// frontend/src/features/analytics-filters/model/usePeriodNavigation.ts
import { ref, computed } from 'vue';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
import {
  getFinancialMonthBounds,
  getFinancialMonth,
  formatFinancialPeriod,
  getDaysInPeriod,
} from '@/shared/lib/utils/financialPeriod';
import { toLocalISODate } from '@/shared/lib/date';
import { getCachedDateFormat } from '@/shared/lib/format/intlCache';
import type { PeriodScale } from './types';

export function usePeriodNavigation() {
  const { startDay, currentPeriod, currentBounds } = useFinancialPeriod();

  const scale = ref<PeriodScale>('month');
  const offset = ref(0);

  // --- Helpers ---

  function getToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  // --- Date range computation ---

  const dateRange = computed<{ startDate: string; endDate: string }>(() => {
    const today = getToday();
    const isCurrent = offset.value === 0;

    switch (scale.value) {
      case 'day': {
        const d = new Date(today);
        d.setDate(d.getDate() + offset.value);
        const iso = toLocalISODate(d);
        return { startDate: iso, endDate: iso };
      }

      case 'month': {
        if (isCurrent) {
          // Current financial month: start to today
          const { start } = currentBounds.value;
          return {
            startDate: toLocalISODate(start),
            endDate: toLocalISODate(today),
          };
        }
        // Past month: compute offset from current financial month
        const { year, month } = currentPeriod.value;
        const targetDate = addMonths(new Date(year, month - 1, 1), offset.value);
        const targetFM = getFinancialMonth(
          new Date(targetDate.getFullYear(), targetDate.getMonth(), startDay.value || 1),
          startDay.value,
        );
        const bounds = getFinancialMonthBounds(targetFM.year, targetFM.month, startDay.value);
        const endInclusive = new Date(bounds.end.getTime() - 1);
        return {
          startDate: toLocalISODate(bounds.start),
          endDate: toLocalISODate(endInclusive),
        };
      }

      case 'year': {
        const targetYear = today.getFullYear() + offset.value;
        if (isCurrent) {
          return {
            startDate: `${targetYear}-01-01`,
            endDate: toLocalISODate(today),
          };
        }
        return {
          startDate: `${targetYear}-01-01`,
          endDate: `${targetYear}-12-31`,
        };
      }
    }
  });

  // --- Comparison date range (previous equivalent period) ---

  const comparisonDateRange = computed<{ startDate: string; endDate: string }>(() => {
    const today = getToday();
    const compOffset = offset.value - 1;

    switch (scale.value) {
      case 'day': {
        const d = new Date(today);
        d.setDate(d.getDate() + compOffset);
        const iso = toLocalISODate(d);
        return { startDate: iso, endDate: iso };
      }

      case 'month': {
        const { year, month } = currentPeriod.value;
        const targetDate = addMonths(new Date(year, month - 1, 1), compOffset);
        const targetFM = getFinancialMonth(
          new Date(targetDate.getFullYear(), targetDate.getMonth(), startDay.value || 1),
          startDay.value,
        );
        const bounds = getFinancialMonthBounds(targetFM.year, targetFM.month, startDay.value);
        const endInclusive = new Date(bounds.end.getTime() - 1);
        return {
          startDate: toLocalISODate(bounds.start),
          endDate: toLocalISODate(endInclusive),
        };
      }

      case 'year': {
        const targetYear = today.getFullYear() + compOffset;
        return {
          startDate: `${targetYear}-01-01`,
          endDate: `${targetYear}-12-31`,
        };
      }
    }
  });

  // --- Labels ---

  const label = computed<string>(() => {
    const today = getToday();

    switch (scale.value) {
      case 'day': {
        const d = new Date(today);
        d.setDate(d.getDate() + offset.value);
        const fmt = getCachedDateFormat('ru-RU', {
          day: 'numeric',
          month: 'long',
          weekday: 'short',
        });
        return fmt.format(d);
      }

      case 'month': {
        if (offset.value === 0) {
          return formatFinancialPeriod(
            currentPeriod.value.year,
            currentPeriod.value.month,
            startDay.value,
          );
        }
        const { year, month } = currentPeriod.value;
        const targetDate = addMonths(new Date(year, month - 1, 1), offset.value);
        const targetFM = getFinancialMonth(
          new Date(targetDate.getFullYear(), targetDate.getMonth(), startDay.value || 1),
          startDay.value,
        );
        return formatFinancialPeriod(targetFM.year, targetFM.month, startDay.value);
      }

      case 'year': {
        return String(today.getFullYear() + offset.value);
      }
    }
  });

  const sublabel = computed<string>(() => {
    const { startDate, endDate } = dateRange.value;
    if (!startDate || !endDate) return '';

    const fmt = getCachedDateFormat('ru-RU', { day: 'numeric', month: 'short' });
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const days = daysInPeriod.value;

    return `${fmt.format(start)} – ${fmt.format(end)} · ${days} дн`;
  });

  // --- Navigation state ---

  const isCurrentPeriod = computed(() => offset.value === 0);
  const canGoNext = computed(() => offset.value < 0);
  const canGoPrev = computed(() => true);

  const daysInPeriod = computed(() => {
    const { startDate, endDate } = dateRange.value;
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diff = end.getTime() - start.getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
  });

  // --- Navigation methods ---

  function setScale(newScale: PeriodScale) {
    scale.value = newScale;
    offset.value = 0;
  }

  function next() {
    if (canGoNext.value) {
      offset.value++;
    }
  }

  function prev() {
    offset.value--;
  }

  function goToday() {
    offset.value = 0;
  }

  return {
    scale,
    offset,
    dateRange,
    comparisonDateRange,
    label,
    sublabel,
    isCurrentPeriod,
    canGoNext,
    canGoPrev,
    daysInPeriod,
    setScale,
    next,
    prev,
    goToday,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/analytics-filters/model/usePeriodNavigation.spec.ts 2>&1 | tail -20`

Expected: All tests PASS. If any fail due to date formatting, adjust test assertions to match `Intl.DateTimeFormat` output for `ru-RU` locale.

---

## Task 3: Create SwipeablePeriodHeader component

**Files:**
- Create: `frontend/src/features/analytics-filters/ui/SwipeablePeriodHeader.vue`

> **Use the `frontend-design` skill** for this component's visual design and implementation.

- [ ] **Step 1: Create SwipeablePeriodHeader.vue**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics/haptics';

const props = defineProps<{
  label: string;
  sublabel: string;
  canGoNext: boolean;
  canGoPrev: boolean;
  isCurrentPeriod: boolean;
  comparisonPercent?: number;
  comparisonLoading?: boolean;
}>();

const emit = defineEmits<{
  prev: [];
  next: [];
  today: [];
}>();

const { trigger } = useHaptics();

// --- Swipe state ---
const translateX = ref(0);
const isDragging = ref(false);
let startX = 0;
let startY = 0;
let isHorizontal: boolean | null = null;

const THRESHOLD = 50;

function onTouchStart(e: TouchEvent) {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
  isDragging.value = true;
  isHorizontal = null;
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return;

  const dx = e.touches[0].clientX - startX;
  const dy = e.touches[0].clientY - startY;

  // Direction detection on first significant move
  if (isHorizontal === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    isHorizontal = Math.abs(dx) > Math.abs(dy);
    if (!isHorizontal) {
      isDragging.value = false;
      translateX.value = 0;
      return;
    }
  }

  if (!isHorizontal) return;

  e.preventDefault();

  // Clamp and apply resistance at edges
  let clampedDx = dx;
  // Dragging right (positive) but can't go next (future)
  if (dx > 0 && !props.canGoNext) {
    clampedDx = dx * 0.3; // resistance
  }
  // Dragging left (negative) but can't go prev
  if (dx < 0 && !props.canGoPrev) {
    clampedDx = dx * 0.3;
  }

  translateX.value = clampedDx;
}

function onTouchEnd() {
  if (!isDragging.value) return;
  isDragging.value = false;

  const dx = translateX.value;

  if (Math.abs(dx) >= THRESHOLD) {
    if (dx < 0 && props.canGoPrev) {
      // Swiped left → go to previous period
      trigger('light');
      emit('prev');
    } else if (dx > 0 && props.canGoNext) {
      // Swiped right → go to next period
      trigger('light');
      emit('next');
    } else {
      // Blocked direction
      trigger('warning');
    }
  }

  // Spring back
  translateX.value = 0;
  isHorizontal = null;
}

// --- Comparison badge ---
const comparisonColor = computed(() => {
  if (props.comparisonPercent == null) return '';
  return props.comparisonPercent > 0
    ? 'text-danger bg-danger/10'
    : 'text-success bg-success/10';
});

const comparisonText = computed(() => {
  if (props.comparisonPercent == null) return '';
  const sign = props.comparisonPercent > 0 ? '+' : '';
  return `${sign}${Math.round(props.comparisonPercent)}%`;
});

// --- Arrow handlers ---
function handlePrev() {
  if (props.canGoPrev) {
    trigger('selection');
    emit('prev');
  }
}

function handleNext() {
  if (props.canGoNext) {
    trigger('selection');
    emit('next');
  }
}

function handleToday() {
  trigger('selection');
  emit('today');
}
</script>

<template>
  <div class="space-y-2">
    <!-- Swipeable header row -->
    <div class="flex items-center gap-2">
      <!-- Left arrow -->
      <button
        class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark transition-colors hover:bg-border-light dark:hover:bg-border-dark disabled:opacity-30"
        :disabled="!canGoPrev"
        @click="handlePrev"
      >
        <UIcon name="chevron_left" :size="18" />
      </button>

      <!-- Center: swipeable label -->
      <div
        class="flex-1 text-center select-none touch-pan-y"
        :style="{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 200ms ease-out',
        }"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
      >
        <div class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
          {{ label }}
        </div>
        <div class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark flex items-center justify-center gap-1.5 mt-0.5">
          <span>{{ sublabel }}</span>
          <!-- Mini comparison badge -->
          <span
            v-if="comparisonPercent != null && !comparisonLoading"
            class="inline-block px-1.5 py-0.5 rounded-md text-[10px] font-semibold leading-none"
            :class="comparisonColor"
          >
            {{ comparisonText }}
          </span>
        </div>
      </div>

      <!-- Right arrow -->
      <button
        class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark transition-colors hover:bg-border-light dark:hover:bg-border-dark disabled:opacity-30"
        :disabled="!canGoNext"
        @click="handleNext"
      >
        <UIcon name="chevron_right" :size="18" />
      </button>
    </div>

    <!-- "Today" button -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div v-if="!isCurrentPeriod" class="flex justify-center">
        <button
          class="px-4 py-1 rounded-full text-xs font-medium bg-primary text-white transition-colors hover:bg-primary/90 active:scale-95"
          @click="handleToday"
        >
          Сегодня
        </button>
      </div>
    </Transition>
  </div>
</template>
```

- [ ] **Step 2: Verify the component compiles**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | grep -i "SwipeablePeriodHeader" | head -5`

Expected: No errors related to SwipeablePeriodHeader.

---

## Task 4: Simplify useAnalyticsFilters

**Files:**
- Modify: `frontend/src/features/analytics-filters/model/useAnalyticsFilters.ts`
- Modify: `frontend/src/features/analytics-filters/model/useAnalyticsFilters.spec.ts`

- [ ] **Step 1: Rewrite useAnalyticsFilters to account-only**

```typescript
// frontend/src/features/analytics-filters/model/useAnalyticsFilters.ts
import { ref, computed } from 'vue';
import type { AccountFilters } from './types';

export function useAnalyticsFilters() {
  const filters = ref<AccountFilters>({
    selectedAccountIds: [],
  });

  function toggleAccount(accountId: string) {
    const index = filters.value.selectedAccountIds.indexOf(accountId);
    if (index === -1) {
      filters.value.selectedAccountIds.push(accountId);
    } else {
      filters.value.selectedAccountIds.splice(index, 1);
    }
  }

  function clearAccountFilters() {
    filters.value.selectedAccountIds = [];
  }

  const activeFilterCount = computed(() => {
    return filters.value.selectedAccountIds.length > 0 ? 1 : 0;
  });

  return {
    filters,
    activeFilterCount,
    toggleAccount,
    clearAccountFilters,
  };
}
```

- [ ] **Step 2: Rewrite tests**

```typescript
// frontend/src/features/analytics-filters/model/useAnalyticsFilters.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAnalyticsFilters } from './useAnalyticsFilters';

describe('useAnalyticsFilters', () => {
  let filters: ReturnType<typeof useAnalyticsFilters>;

  beforeEach(() => {
    filters = useAnalyticsFilters();
  });

  describe('initial state', () => {
    it('defaults to empty selectedAccountIds', () => {
      expect(filters.filters.value.selectedAccountIds).toEqual([]);
    });

    it('activeFilterCount is 0', () => {
      expect(filters.activeFilterCount.value).toBe(0);
    });
  });

  describe('toggleAccount', () => {
    it('adds account id when not present', () => {
      filters.toggleAccount('acc-1');
      expect(filters.filters.value.selectedAccountIds).toContain('acc-1');
    });

    it('removes account id when already present', () => {
      filters.toggleAccount('acc-1');
      filters.toggleAccount('acc-1');
      expect(filters.filters.value.selectedAccountIds).not.toContain('acc-1');
    });

    it('handles multiple accounts', () => {
      filters.toggleAccount('acc-1');
      filters.toggleAccount('acc-2');
      expect(filters.filters.value.selectedAccountIds).toEqual(['acc-1', 'acc-2']);
    });
  });

  describe('clearAccountFilters', () => {
    it('empties selectedAccountIds', () => {
      filters.toggleAccount('acc-1');
      filters.toggleAccount('acc-2');
      filters.clearAccountFilters();
      expect(filters.filters.value.selectedAccountIds).toEqual([]);
    });
  });

  describe('activeFilterCount', () => {
    it('is 1 when accounts are selected', () => {
      filters.toggleAccount('acc-1');
      expect(filters.activeFilterCount.value).toBe(1);
    });

    it('is 0 after clearing', () => {
      filters.toggleAccount('acc-1');
      filters.clearAccountFilters();
      expect(filters.activeFilterCount.value).toBe(0);
    });
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/features/analytics-filters/model/useAnalyticsFilters.spec.ts 2>&1 | tail -10`

Expected: All PASS.

---

## Task 5: Update barrel exports and delete DateRangePicker

**Files:**
- Modify: `frontend/src/features/analytics-filters/index.ts`
- Delete: `frontend/src/features/analytics-filters/ui/DateRangePicker.vue`

- [ ] **Step 1: Update index.ts**

```typescript
// frontend/src/features/analytics-filters/index.ts

// Types
export type { PeriodScale, TransactionType, AccountFilters, CategoryStat } from './model/types';

// Helpers
export { mapCategoryStats, mapExpenseCategoryStats } from './model/mapCategoryBreakdown';

// Composables
export { useAnalyticsFilters } from './model/useAnalyticsFilters';
export { useConvertedAnalytics } from './model/useConvertedAnalytics';
export { usePeriodNavigation } from './model/usePeriodNavigation';

// UI Components
export { default as FilterChips } from './ui/FilterChips.vue';
export { default as SwipeablePeriodHeader } from './ui/SwipeablePeriodHeader.vue';
```

- [ ] **Step 2: Delete DateRangePicker.vue**

Run: `rm frontend/src/features/analytics-filters/ui/DateRangePicker.vue`

- [ ] **Step 3: Run all analytics filter tests**

Run: `cd frontend && npx vitest run src/features/analytics-filters/ 2>&1 | tail -15`

Expected: All PASS.

---

## Task 6: Rewrite AnalyticsPage.vue

**Files:**
- Rewrite: `frontend/src/pages/analytics/AnalyticsPage.vue`

> **Use the `frontend-design` skill** for the page layout and transitions.

This is the largest task. The page is completely rewritten to:
1. Use `usePeriodNavigation()` instead of period tabs
2. Use `SwipeablePeriodHeader` for swipe + arrows + "Today" button
3. Single scrollable content flow (no section tabs)
4. Slide `<Transition>` on content with key `${scale}-${offset}`
5. Conditional widget visibility per scale
6. Prefetch adjacent periods via `queryClient.prefetchQuery()`
7. Mini-comparison badge from previous period data

- [ ] **Step 1: Write the new AnalyticsPage.vue**

```vue
<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { AppHeader } from '@/widgets/header';
import {
  IncomeExpenseBar,
  DailyStatsCards,
  SavingsGauge,
  DonutChart,
  DailyExpenseChart,
  PeriodComparison,
  SpendingPaceChart,
  type DonutSegment,
} from '@/widgets/analytics';
import { PageContainer, UTabs, UCard, EmptyState, Skeleton } from '@/shared/ui';
import { useDailyStats, transactionQueryKeys } from '@/entities/transaction';
import { useBudget } from '@/entities/budget';
import { useAccounts } from '@/entities/account';
import { toLocalISODate } from '@/shared/lib/date';
import {
  FilterChips,
  SwipeablePeriodHeader,
  useAnalyticsFilters,
  useConvertedAnalytics,
  usePeriodNavigation,
  mapCategoryStats,
  type PeriodScale,
} from '@/features/analytics-filters';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
import { getFinancialMonthBounds } from '@/shared/lib/utils/financialPeriod';

const route = useRoute();
const queryClient = useQueryClient();
const { userId } = useCurrentUser();
const { currency } = useUserCurrency();

// --- Period navigation ---
const {
  scale,
  offset,
  dateRange,
  comparisonDateRange,
  label,
  sublabel,
  isCurrentPeriod,
  canGoNext,
  canGoPrev,
  daysInPeriod,
  setScale,
  next,
  prev,
  goToday,
} = usePeriodNavigation();

// --- Account filters ---
const { filters, toggleAccount, clearAccountFilters } = useAnalyticsFilters();

const { accounts } = useAccounts(userId);

const accountChips = computed(() =>
  accounts.value.map((acc) => ({
    id: acc.id,
    name: acc.name,
    icon: acc.icon,
    color: acc.color,
  })),
);

const showAccountFilter = computed(() => accountChips.value.length > 1);

// --- Scale tabs ---
const scaleItems = [
  { id: 'day', label: 'День' },
  { id: 'month', label: 'Месяц' },
  { id: 'year', label: 'Год' },
];

// --- Main analytics data ---
const startDateStr = computed(() => dateRange.value.startDate);
const endDateStr = computed(() => dateRange.value.endDate);

const analyticsOptions = {
  startDate: startDateStr,
  endDate: endDateStr,
  accountIds: computed(() => filters.value.selectedAccountIds),
};

const {
  convertedIncome,
  convertedExpense,
  savingsRate,
  categoryBreakdown,
  convertAmount,
  isLoading: analyticsLoading,
  isFetching: analyticsFetching,
} = useConvertedAnalytics(analyticsOptions, currency);

// --- Comparison data (previous period) ---
const {
  convertedExpense: prevExpense,
  convertedIncome: prevIncome,
  savingsRate: prevSavingsRate,
  isLoading: prevLoading,
} = useConvertedAnalytics(
  {
    startDate: computed(() => comparisonDateRange.value.startDate),
    endDate: computed(() => comparisonDateRange.value.endDate),
    accountIds: computed(() => filters.value.selectedAccountIds),
  },
  currency,
);

// Mini comparison badge
const comparisonPercent = computed(() => {
  if (prevLoading.value || prevExpense.value === 0) return undefined;
  const diff = convertedExpense.value - prevExpense.value;
  return (diff / prevExpense.value) * 100;
});

// --- Available balance ---
const availableBalance = computed(() => {
  const selectedIds = filters.value.selectedAccountIds;
  const filtered =
    selectedIds.length > 0
      ? accounts.value.filter((a) => selectedIds.includes(a.id))
      : accounts.value.filter((a) => a.type === 'basic');

  return filtered.reduce((sum, acc) => {
    return (
      sum +
      acc.balances.reduce((bSum, b) => {
        const bal = acc.type === 'credit_card' ? Math.max(0, b.balance) : b.balance;
        return bSum + convertAmount(bal, b.currency);
      }, 0)
    );
  }, 0);
});

// --- Spending Pace (Month scale only, for viewed month) ---
const { startDay, daysRemaining: financialDaysRemaining } = useFinancialPeriod();
const { budget, isLoading: budgetLoading } = useBudget(userId);

const showPace = computed(() => scale.value === 'month' && (!!budget.value || budgetLoading.value));

const paceStartStr = computed(() => dateRange.value.startDate);
const paceEndStr = computed(() => dateRange.value.endDate);

const paceTotalDays = computed(() => daysInPeriod.value);

const paceTodayIndex = computed(() => {
  if (!isCurrentPeriod.value) return paceTotalDays.value; // past month: fully complete
  const start = new Date(dateRange.value.startDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = today.getTime() - start.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
});

const { entries: paceRaw, isLoading: paceStatsLoading } = useDailyStats({
  startDate: computed(() => (showPace.value ? paceStartStr.value : null)),
  endDate: computed(() => (showPace.value ? paceEndStr.value : null)),
  accountIds: computed(() => filters.value.selectedAccountIds),
  groupBy: 'day',
});

const paceLoading = computed(() => paceStatsLoading.value || budgetLoading.value);

function convertExpenseByCurrency(byCurrency: Record<string, number>): number {
  return Object.entries(byCurrency).reduce((sum, [c, a]) => sum + convertAmount(a, c), 0);
}

const paceBudgetAmount = computed(() => {
  if (!budget.value) return 0;
  const { amount, currency: budgetCurrency } = budget.value.budget;
  if (budgetCurrency === currency.value) return amount;
  return convertAmount(amount, budgetCurrency);
});

const paceEntries = computed(() => {
  if (paceRaw.value.length === 0) return [];

  const amount = paceBudgetAmount.value;
  const days = paceTotalDays.value;
  const todayIdx = paceTodayIndex.value;

  const expenseMap = new Map<string, number>();
  for (const e of paceRaw.value) {
    expenseMap.set(e.date, convertExpenseByCurrency(e.expense_by_currency));
  }

  let cum = 0;
  const result: { day: number; actual: number; ideal: number; date: string }[] = [];
  const start = new Date(dateRange.value.startDate + 'T00:00:00');

  for (let i = 0; i <= todayIdx; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const ds = toLocalISODate(d);
    cum += expenseMap.get(ds) ?? 0;
    result.push({
      day: i + 1,
      actual: cum,
      ideal: amount > 0 ? (amount / days) * (i + 1) : 0,
      date: ds,
    });
  }

  return result;
});

// --- Conditional widget visibility ---
const showSpendingPace = computed(() => scale.value === 'month' && showPace.value);
const showDailyStats = computed(() => scale.value === 'month');
const showTrendsChart = computed(() => scale.value !== 'day');

// --- Categories ---
const categoryType = ref<'expense' | 'income'>('expense');
const categoryTypeItems = [
  { id: 'expense', label: 'Расходы' },
  { id: 'income', label: 'Доходы' },
];

function handleCategoryTypeChange(value: string | number) {
  categoryType.value = value as 'expense' | 'income';
}

const categoryStats = computed(() =>
  mapCategoryStats(categoryBreakdown.value, categoryType.value, convertAmount),
);

const donutTotal = computed(() => categoryStats.value.reduce((sum, s) => sum + s.amount, 0));

const donutSegments = computed<DonutSegment[]>(() =>
  categoryStats.value.map((s) => ({
    id: s.id,
    value: s.amount,
    percent: s.percent,
    color: s.color,
    label: s.name,
    icon: s.icon,
  })),
);

// --- Trends chart ---
const groupBy = computed<'day' | 'week' | 'month'>(() => {
  if (scale.value === 'year') return 'month';
  const days = daysInPeriod.value;
  if (days <= 31) return 'day';
  if (days <= 90) return 'week';
  return 'month';
});

const { entries: dailyEntries, isLoading: dailyLoading } = useDailyStats({
  startDate: computed(() => (showTrendsChart.value ? startDateStr.value : null)),
  endDate: computed(() => (showTrendsChart.value ? endDateStr.value : null)),
  accountIds: computed(() => filters.value.selectedAccountIds),
  groupBy,
});

const chartEntries = computed(() =>
  dailyEntries.value.map((e) => ({
    date: e.date,
    expense: convertExpenseByCurrency(e.expense_by_currency),
  })),
);

// --- Period comparison ---
const noPrevData = computed(() => prevIncome.value === 0 && prevExpense.value === 0);

// --- Empty state ---
const hasNoData = computed(
  () => convertedIncome.value === 0 && convertedExpense.value === 0 && !analyticsLoading.value,
);

// --- Transition ---
const transitionName = ref<'slide-left' | 'slide-right' | 'fade'>('fade');
const transitionKey = computed(() => `${scale.value}-${offset.value}`);

function handlePrev() {
  transitionName.value = 'slide-left';
  prev();
}

function handleNext() {
  transitionName.value = 'slide-right';
  next();
}

function handleToday() {
  transitionName.value = 'slide-right';
  goToday();
}

function handleScaleChange(value: string | number) {
  transitionName.value = 'fade';
  setScale(value as PeriodScale);
}

// --- Prefetch adjacent periods ---
watch(
  [startDateStr, endDateStr, () => filters.value.selectedAccountIds],
  () => {
    const accountIds = filters.value.selectedAccountIds;

    // Prefetch previous period (offset - 1)
    const prevRange = comparisonDateRange.value;
    if (prevRange.startDate && prevRange.endDate) {
      queryClient.prefetchQuery({
        queryKey: transactionQueryKeys.analyticsStats(prevRange.startDate, prevRange.endDate, accountIds),
      });
    }

    // Prefetch next period (offset + 1) — only if not already at current
    if (canGoNext.value) {
      // Next period is handled by shifting offset temporarily — skip for simplicity
      // The current period data is already cached from initial load
    }
  },
  { immediate: true },
);

// --- Read initial query param ---
onMounted(() => {
  const queryType = route.query.type as string | undefined;
  if (queryType === 'income') {
    categoryType.value = 'income';
  } else if (queryType === 'expense') {
    categoryType.value = 'expense';
  }
});
</script>

<template>
  <PageContainer class="relative bg-background-light dark:bg-background-dark">
    <template #header>
      <AppHeader title="Аналитика" />
    </template>

    <!-- Sticky filters -->
    <div
      class="sticky z-20 -mx-5 lg:-mx-8 px-5 lg:px-8 py-2 space-y-3 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-border-light/50 dark:border-border-dark/50 shadow-sm"
      :style="{ top: '0' }"
    >
      <!-- Scale Tabs -->
      <UTabs
        :model-value="scale"
        :items="scaleItems"
        @update:model-value="handleScaleChange"
      />

      <!-- Swipeable Period Header -->
      <SwipeablePeriodHeader
        :label="label"
        :sublabel="sublabel"
        :can-go-next="canGoNext"
        :can-go-prev="canGoPrev"
        :is-current-period="isCurrentPeriod"
        :comparison-percent="comparisonPercent"
        :comparison-loading="prevLoading"
        @prev="handlePrev"
        @next="handleNext"
        @today="handleToday"
      />

      <!-- Account Filter Chips -->
      <FilterChips
        v-if="showAccountFilter"
        :items="accountChips"
        :selected-ids="filters.selectedAccountIds"
        label="Счета"
        @toggle="toggleAccount"
        @clear="clearAccountFilters"
      />
    </div>

    <!-- Content with slide transition -->
    <main class="pt-4 pb-28 md:pb-8">
      <Transition
        :name="transitionName"
        mode="out-in"
      >
        <div
          :key="transitionKey"
          class="space-y-4 transition-opacity duration-300"
          :class="{ 'opacity-50 pointer-events-none': analyticsFetching && !analyticsLoading }"
        >
          <!-- Empty state -->
          <UCard v-if="hasNoData" variant="bordered" class="py-8">
            <EmptyState
              icon="bar_chart"
              title="Нет транзакций"
              description="Нет данных за выбранный период"
            />
          </UCard>

          <template v-else>
            <!-- === OVERVIEW SECTION === -->
            <div class="flex flex-col lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
              <!-- Income/Expense — full width -->
              <div class="lg:col-span-2">
                <IncomeExpenseBar
                  :income="convertedIncome"
                  :expense="convertedExpense"
                  :currency="currency"
                  :loading="analyticsLoading"
                />
              </div>

              <!-- Spending Pace (Month only) -->
              <SpendingPaceChart
                v-if="showSpendingPace || paceLoading"
                :entries="paceEntries"
                :budget-amount="paceBudgetAmount"
                :total-days="paceTotalDays"
                :today-index="paceTodayIndex"
                :currency="currency"
                :period-label="label"
                :loading="paceLoading"
              />

              <!-- Savings Gauge -->
              <SavingsGauge
                :total-income="convertedIncome"
                :total-expense="convertedExpense"
                :available-balance="availableBalance"
                :currency="currency"
              />

              <!-- Daily Stats (Month only) — full width -->
              <div v-if="showDailyStats" class="lg:col-span-2">
                <DailyStatsCards
                  :total-expense="convertedExpense"
                  :available-balance="availableBalance"
                  :days-in-period="daysInPeriod"
                  :days-remaining-in-month="isCurrentPeriod ? financialDaysRemaining : daysInPeriod"
                  :currency="currency"
                  :is-past-period="!isCurrentPeriod"
                  :balance-label="filters.selectedAccountIds.length > 0 ? 'По выбранным счетам' : undefined"
                />
              </div>
            </div>

            <!-- === CATEGORIES SECTION === -->
            <div class="border-t border-border-light/50 dark:border-border-dark/50 pt-4 space-y-4">
              <UTabs
                :model-value="categoryType"
                :items="categoryTypeItems"
                size="sm"
                @update:model-value="handleCategoryTypeChange"
              />

              <template v-if="analyticsLoading">
                <Skeleton class="h-48 w-48 mx-auto rounded-full" />
              </template>

              <template v-else>
                <DonutChart
                  v-if="donutSegments.length > 0"
                  :segments="donutSegments"
                  :total="donutTotal"
                  :currency="currency"
                />

                <UCard v-else variant="bordered" class="py-4">
                  <EmptyState
                    icon="pie_chart"
                    title="Нет данных"
                    description="Нет транзакций для анализа за выбранный период"
                  />
                </UCard>
              </template>
            </div>

            <!-- === TRENDS SECTION === -->
            <template v-if="showTrendsChart">
              <div class="border-t border-border-light/50 dark:border-border-dark/50 pt-4 space-y-4">
                <div class="flex flex-col lg:flex-row lg:gap-4 space-y-4 lg:space-y-0">
                  <div class="lg:flex-1">
                    <DailyExpenseChart
                      :entries="chartEntries"
                      :currency="currency"
                      :loading="dailyLoading"
                      :group-by="groupBy"
                    />
                  </div>

                  <div class="lg:flex-1">
                    <PeriodComparison
                      :current-expense="convertedExpense"
                      :previous-expense="prevExpense"
                      :current-income="convertedIncome"
                      :previous-income="prevIncome"
                      :current-savings-rate="savingsRate"
                      :previous-savings-rate="prevSavingsRate"
                      :currency="currency"
                      :loading="prevLoading"
                      :no-data="noPrevData"
                    />
                  </div>
                </div>
              </div>
            </template>
          </template>
        </div>
      </Transition>
    </main>
  </PageContainer>
</template>

<style scoped>
/* Slide left: content exits left, enters from right */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 150ms ease-out;
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Slide right: content exits right, enters from left */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 150ms ease-out;
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* Fade: used for scale changes to avoid confusion with period swipe */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms ease-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

- [ ] **Step 2: Verify the page compiles**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | tail -20`

Expected: No errors (or only pre-existing unrelated warnings).

- [ ] **Step 3: Run dev server and verify visually**

Run: `cd frontend && bun run dev`

Open `http://localhost:5173/analytics` in the browser. Verify:
- Scale tabs (День/Месяц/Год) render and switch
- Period header shows correct label and sublabel
- Arrow buttons work (left goes to past, right disabled at current)
- "Сегодня" button appears when viewing past period
- Content transitions with slide animation
- Widgets show/hide correctly per scale (pace chart only in Month, etc.)
- Account filter chips still work

---

## Task 7: Run full test suite and fix issues

**Files:**
- Any files from previous tasks that need fixes

- [ ] **Step 1: Run all analytics-related tests**

Run: `cd frontend && npx vitest run src/features/analytics-filters/ 2>&1`

Expected: All PASS.

- [ ] **Step 2: Run full frontend type check**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | tail -30`

Expected: No errors.

- [ ] **Step 3: Run full build**

Run: `cd frontend && bun run build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 4: Fix any issues found**

If any tests fail or type errors appear, fix them in the relevant files. Common issues to watch for:
- `transactionQueryKeys` import path — ensure it's exported from `@/entities/transaction`
- `DonutSegment` type — ensure it's still exported from `@/widgets/analytics`
- `mapCategoryStats` signature — ensure it matches the current barrel export
- `useConvertedAnalytics` options — ensure `accountIds` computed wrapper is correct
