# Receipt Amount Display & Scan Button Redesign

**Date**: 2026-02-25

## Problem

1. Receipt items with service charge (+20%) display amounts confusingly — the total is shown but the relationship between base price and markup is unclear
2. "Сканировать" button is isolated below Quick Actions, should be integrated into the same row

## Design

### 1. Receipt Item — Strikethrough Base + Total

Show prices in a e-commerce discount style (but for surcharge):

```
                    ~~60 000~~ +20%
                     72 000 UZS
```

- Strikethrough base price in small secondary text
- `+X%` badge next to the strikethrough price
- Total with service charge below, bold and prominent
- When no service charge, show just the total as before

**File**: `frontend/src/features/scan-receipt/ui/ReceiptItemRow.vue` (lines 164-179)

### 2. Scan Button + Quick Actions — Horizontal Scroll

Merge "Сканировать" and Quick Actions into one horizontally scrollable section:

- Replace `grid grid-cols-4` with `flex overflow-x-auto` and snap-scroll
- "Сканировать" is the first item, same size as quick action buttons
- 4 quick action slots follow
- Total 5 items, ~4 visible on screen, subtle scroll indicator
- Remove the separate scan button section from DashboardPage

**Files**:
- `frontend/src/pages/dashboard/ui/DashboardQuickActions.vue` — add scan as first item
- `frontend/src/pages/dashboard/DashboardPage.vue` — remove separate scan section, pass scan handler to QuickActions
