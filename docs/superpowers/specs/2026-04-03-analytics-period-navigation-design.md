# Analytics Page: Apple-Style Period Navigation Redesign

## Summary

Redesign the analytics page time filtering to follow the Apple Health/Fitness pattern: scale tabs (Day/Month/Year) at the top, swipeable period header for navigating between periods, and a single scrollable content flow replacing the current section tabs.

## Goals

- Apple Health-like navigation: tabs set the scale, swipe navigates between periods
- Remove week filter and custom date range picker
- Replace section tabs (Overview/Categories/Trends) with a single scrollable flow
- Smooth animations, haptic feedback, and prefetch for instant transitions

## Navigation Model

### Scale Tabs

Three tabs in the sticky header: **День / Месяц / Год**.

| Scale | Label format | Swipe unit | Example |
|-------|-------------|-----------|---------|
| Day | "3 апреля, Чт" | ±1 day | "2 апреля, Ср" → "3 апреля, Чт" → blocked |
| Month | "Март 2026" | ±1 month | "Февраль 2026" → "Март 2026" → blocked |
| Year | "2026" | ±1 year | "2025" → "2026" → blocked |

Month scale respects the user's `financial_month_start_day` setting for date boundaries via `useFinancialPeriod()`.

### Swipeable Period Header

The period header (date label area) is the swipe zone. It sits between the scale tabs and the account filter chips in the sticky header.

**Elements:**
- Left arrow button `‹` (tappable, alternative to swipe)
- Center: period label + date range subtitle + mini-comparison badge
- Right arrow button `›` (disabled when at current period)

**Swipe behavior:**
- Threshold: 50px horizontal displacement
- Below threshold: spring-back animation to original position
- Above threshold: commit navigation, slide transition
- Vertical swipe detection cancels horizontal swipe (no scroll conflicts)
- Animation: 200ms ease-out

**Swipe direction convention (matches Apple Health):**
- Swipe LEFT (drag finger leftward) = go to **previous** period (back in time, offset decreases)
- Swipe RIGHT (drag finger rightward) = go to **next** period (forward in time, offset increases)

**Constraints:**
- Cannot navigate into the future — right arrow disabled, swipe right blocked at offset 0
- No minimum past boundary (can swipe back indefinitely)

### "Today" Button

- Appears below the period header when `offset !== 0`
- Centered, pill-shaped button with text "Сегодня"
- Fade-in/out transition (200ms)
- On tap: resets offset to 0, haptic "selection"

### Mini-Comparison Badge

- Small badge next to the date range subtitle: `+12%` (red) or `-8%` (green)
- Compares total expenses with the previous equivalent period
- Data sourced from the prefetch cache (previous period is always preloaded)
- Green = expenses decreased, Red = expenses increased

## Content Flow

Replace three section tabs with a single scrollable stream. The visible widgets depend on the current scale.

### Widget Order (top to bottom)

| # | Widget | Day | Month | Year |
|---|--------|-----|-------|------|
| 1 | IncomeExpenseBar | Yes | Yes | Yes |
| 2 | SpendingPaceChart | No | Yes | No |
| 3 | SavingsGauge | Yes | Yes | Yes |
| 4 | DailyStatsCards | No | Yes | No |
| 5 | --- separator --- | | | |
| 6 | DonutChart (categories) | Yes | Yes | Yes |
| 7 | --- separator --- | | | |
| 8 | DailyExpenseChart (trends) | No | Yes (by day) | Yes (by month) |
| 9 | PeriodComparison | Yes | Yes | Yes |

### Category Type Toggle

The DonutChart section includes an inline toggle (Расходы/Доходы) — a small pills tab, not a separate section tab. This replaces the current category type tabs that lived in the Categories section tab.

### Chart GroupBy

- Day scale: no daily chart (single data point)
- Month scale: `groupBy: 'day'`
- Year scale: `groupBy: 'month'`

## Animations

### Slide Transition (Content)

When the period changes (via swipe, arrow tap, or "Today" button):

1. Current content slides out with opacity fade (150ms, ease-out, translateX ±20px)
2. New content slides in from opposite direction (150ms, ease-out)
3. Implementation: Vue `<Transition mode="out-in">` with dynamic key `${scale}-${offset}`

Direction: navigating to past → content slides right-to-left. Navigating to future → left-to-right.

### Scale Change

When switching between Day/Month/Year tabs: same slide transition but vertical (translateY) or simple fade — no horizontal slide to avoid confusion with period navigation.

## Haptic Feedback

| Action | Haptic | Description |
|--------|--------|-------------|
| Swipe crosses 50px threshold | `trigger('selection')` | Light vibration confirming gesture recognized |
| Period successfully changed | `trigger('light')` | Confirmation of navigation |
| Tap "Сегодня" | `trigger('selection')` | Button feedback |
| Swipe blocked (future) | `trigger('warning')` | Cannot go further |

Uses existing `useHaptics()` composable from `shared/lib/haptics/`.

## Data Layer

### Prefetch Strategy

After each navigation, prefetch `offset - 1` and `offset + 1` (if not future) using `queryClient.prefetchQuery()`.

**What is prefetched:**
- Analytics stats (income/expense/categories) — via `analyticsQueryKeys`
- Daily stats (for trend charts) — via `dailyStatsQueryKeys`

**Timing:** `watchEffect` on `dateRange` change triggers prefetch of adjacent periods.

**Cache behavior:**
- `staleTime: 30_000` (30 seconds, matching current analytics config)
- `keepPreviousData: true` — old data stays visible during navigation instead of showing skeletons
- Comparison data for mini-badge comes from the prefetched previous period

### SpendingPaceChart

SpendingPaceChart shows for the currently viewed month in Month scale. For past months, it displays the full month's completed data (all days filled). For the current month, it shows progress up to today. Hidden in Day and Year scales. If no budget exists, pace chart is hidden entirely.

## Architecture

### New Files

#### `features/analytics-filters/model/usePeriodNavigation.ts`

```typescript
interface UsePeriodNavigationReturn {
  scale: Ref<PeriodScale>                    // 'day' | 'month' | 'year'
  offset: Ref<number>                        // 0 = current, -1 = previous, etc.
  dateRange: ComputedRef<{ startDate: string; endDate: string }>
  label: ComputedRef<string>                 // "Март 2026", "3 апреля, Чт", "2026"
  sublabel: ComputedRef<string>              // "1 мар – 31 мар · 31 дн"
  canGoNext: ComputedRef<boolean>            // false when offset === 0
  canGoPrev: ComputedRef<boolean>            // always true (no lower bound)
  isCurrentPeriod: ComputedRef<boolean>      // offset === 0
  comparisonDateRange: ComputedRef<{ startDate: string; endDate: string }>
  daysInPeriod: ComputedRef<number>
  setScale: (scale: PeriodScale) => void     // resets offset to 0
  next: () => void
  prev: () => void
  goToday: () => void                        // offset = 0
}
```

Internally uses `useFinancialPeriod()` for month boundaries when `financial_month_start_day !== 1`.

#### `features/analytics-filters/ui/SwipeablePeriodHeader.vue`

**Props:**
```typescript
{
  label: string
  sublabel: string
  canGoNext: boolean
  canGoPrev: boolean
  isCurrentPeriod: boolean
  comparisonPercent?: number    // +12 or -8, for the mini badge
  comparisonLoading?: boolean
}
```

**Emits:** `prev`, `next`, `today`

**Internal:**
- Touch event handling (touchstart/touchmove/touchend on the label area)
- Horizontal vs vertical detection
- Threshold logic (50px)
- Spring-back animation
- Arrow buttons calling emit
- "Сегодня" button with fade transition
- Haptic feedback via `useHaptics()`
- Mini-comparison badge rendering

### Modified Files

#### `features/analytics-filters/model/types.ts`

```typescript
// Remove
type LitePeriod = 'week-start' | 'month-start' | 'year-start' | 'custom';

// Add
type PeriodScale = 'day' | 'month' | 'year';

// Simplify AnalyticsFilters
interface AnalyticsFilters {
  selectedAccountIds: string[];
}
```

#### `features/analytics-filters/model/useAnalyticsFilters.ts`

Simplify to only manage account filters. Remove period/customDateRange/type management — period navigation is now handled by `usePeriodNavigation`, and category type toggle is local to the DonutChart section.

#### `features/analytics-filters/index.ts`

Export new modules: `usePeriodNavigation`, `SwipeablePeriodHeader`, `PeriodScale`.
Remove exports: `DateRangePicker`, `LitePeriod`.

#### `pages/analytics/AnalyticsPage.vue`

Major rewrite:
- Remove section tabs (UTabs for Overview/Categories/Trends)
- Remove DateRangePicker integration
- Remove period tabs (week/month/year/custom UTabs)
- Add `usePeriodNavigation()` composable
- Add `SwipeablePeriodHeader` component
- Single scrollable content flow with conditional widget visibility per scale
- Slide `<Transition>` wrapper around content with key `${scale}-${offset}`
- Prefetch logic via `watchEffect` + `queryClient.prefetchQuery()`
- Category type toggle inline in the categories section
- Comparison data for mini-badge computed from prefetched previous period

### Removed Files/Code

- `DateRangePicker.vue` — no longer needed (no custom date range)
- Section tab items array and `activeTab` state
- `showCustomDatePicker` computed
- `isTrendsActive` / `isOverviewActive` computed guards for lazy loading
- `LitePeriod` type

## Sticky Header Structure

Final layout of the sticky filter bar (top to bottom):

1. **Scale tabs** — День / Месяц / Год (UTabs, pills variant)
2. **SwipeablePeriodHeader** — swipeable label + arrows + mini-comparison + "Сегодня"
3. **Account filter chips** — FilterChips (only shown if >1 account)

## Edge Cases

- **First-time user (no data):** Empty state shows for current period. Swipe to past still works but shows empty state there too.
- **Financial period boundary:** Month scale uses `useFinancialPeriod()` to calculate correct start/end dates. Day and Year scales use calendar boundaries.
- **Budget for past months:** SpendingPaceChart in Month scale for past months shows completed data. Budget amount is the same (current budget). If no budget exists, pace chart is hidden.
- **Rapid swipes:** Debounce is not needed — each swipe increments offset, Vue Query handles concurrent requests. `keepPreviousData` ensures smooth display.
- **Desktop:** Arrow buttons are the primary navigation. Swipe still works via mouse drag. No hover states needed on the swipe zone itself, but arrows get hover states.
- **Query param `?type=income/expense`:** Still works — sets the initial category type toggle, scrolls to the categories section.
