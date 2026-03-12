# Web/Desktop Adaptation Design

**Date:** 2026-03-12
**Status:** Approved
**Scope:** All main pages and features except Welcome/Auth

## Overview

Adapt the mobile-first finance app for desktop (1280px+) using the **Layout Components** approach: create reusable layout components (`PageContainer`, `MasterDetailLayout`) and adapt existing `UModal`. Content components remain unchanged — layout is isolated from content.

## Decisions

| Decision | Choice |
|----------|--------|
| Target screen size | Desktop 1280px+ |
| Approach | Layout Components (reusable wrappers) |
| Modal behavior on desktop | Centered modals with limited width + backdrop |
| List page detail view | Master-detail layout (list + detail panel) |
| Master-detail scope | All list pages (History, Accounts, Debts, Goals, Reminders) |
| Dashboard changes | Polish existing 8/4 grid, add PageContainer wrapper |
| Content width constraint | max-w-7xl (1280px) centered, consistent across pages |
| Desktop breakpoint | `lg: 1024px` |

## Section 1: Layout Components

Three components in `shared/ui/`:

### 1.1 PageContainer

Wrapper for all page content. Provides `max-w-7xl mx-auto` centering with responsive padding.

```vue
<PageContainer>
  <template #header>...</template>
  <slot />  <!-- content with max-w-7xl mx-auto -->
</PageContainer>
```

**Behavior:**
- Applies `max-w-7xl mx-auto px-5 lg:px-8` to content
- Header slot for page title/actions
- No visual change on mobile — just padding normalization

### 1.2 MasterDetailLayout

Split-view for list pages. Desktop: list (flex-5) + detail panel (flex-4). Mobile: list only, click navigates to detail page.

```vue
<MasterDetailLayout :selected="selectedId" @close="selectedId = null">
  <template #master>
    <TransactionList @select="selectedId = $event" />
  </template>
  <template #detail>
    <TransactionDetail :id="selectedId" />
  </template>
  <template #empty>
    <EmptyState message="Выберите элемент" />
  </template>
</MasterDetailLayout>
```

**Props:**
- `selected` — ID of selected item (controls detail panel visibility)

**Events:**
- `close` — emitted when detail panel is closed

**Behavior:**
- `< lg`: renders only `#master` slot, full width. Click triggers router navigation to detail page
- `>= lg`: renders `#master` (flex-5) + divider + `#detail` or `#empty` (flex-4)
- Detail panel shows `#empty` slot when `selected` is null
- Wrapped in `PageContainer` internally (max-w-7xl)

### 1.3 UModal Adaptation

Existing `UModal` component gets a `size` prop for desktop. Mobile behavior unchanged (fullscreen).

```vue
<UModal size="sm">  <!-- Confirmations: max-w-sm (384px) -->
<UModal>            <!-- Default = md: max-w-lg (512px) -->
<UModal size="lg">  <!-- Complex forms: max-w-xl (576px) -->
```

**Desktop behavior:**
- Centered on screen with semi-transparent backdrop
- Close button (✕) in top-right corner
- Click outside to close
- Rounded corners (`rounded-xl`), shadow

**Mobile behavior (unchanged):**
- Fullscreen overlay
- `size` prop ignored

## Section 2: Page Adaptations

### 2.1 Dashboard

**Layout:** `PageContainer` wrapper
**Changes:** Minimal — add `max-w-7xl` wrapper, improve `lg:px-8` padding. Existing 8/4 grid (col-span-8 + col-span-4 sticky) stays as-is.

### 2.2 History

**Layout:** `MasterDetailLayout`
**Master panel:** VirtualGroupedTransactionList with filter tabs (All/Expense/Income/Transfer) and search
**Detail panel:** Transaction details — icon, amount, category, account, date, notes + Edit/Delete actions
**Edit action:** Opens `UModal` (size="md") with EditTransactionForm
**Delete action:** Opens `UModal` (size="sm") with ConfirmDeleteModal

### 2.3 Accounts

**Layout:** `MasterDetailLayout`
**Master panel:** Total balance card + draggable account list + "New account" button
**Detail panel:** Account header (name, balance) + recent transactions for selected account (using `useInfiniteAccountTransactions`)
**Edit action:** Opens `UModal` (size="md") with EditAccountForm

### 2.4 Debts

**Layout:** `MasterDetailLayout`
**Master panel:** Debt cards grouped by person or flat, "New debt" button
**Detail panel:** Debt details — person, amount, progress bar, payment history + Payment/Edit/Delete actions
**Payment action:** Opens `UModal` (size="sm") with partial payment form

### 2.5 Goals

**Layout:** `MasterDetailLayout`
**Master panel:** Goal cards with progress indicators
**Detail panel:** Goal details — target amount, current savings, progress, contribution history

### 2.6 Reminders

**Layout:** `MasterDetailLayout`
**Master panel:** Reminders grouped by today/this week/upcoming
**Detail panel:** Reminder details — amount, date, recurrence, linked account

### 2.7 Analytics

**Layout:** `PageContainer`
**Changes:**
- Stats cards: `grid-cols-2` → `lg:grid-cols-4`
- Charts: use full container width, side-by-side layout for related charts (e.g., daily expenses 3/5 + donut chart 2/5)
- Sticky filters remain at top
- No master-detail — analytics is a single-pane view

### 2.8 Profile / Settings

**Layout:** `PageContainer` with `max-w-2xl` inner constraint
**Changes:** Profile form and settings list centered in narrower column for readability. Settings sub-pages (currency, categories, import) remain as page navigations (not modals).

## Section 3: Modals, Navigation & Details

### 3.1 Modal Sizes

| Size | Width | Use Case |
|------|-------|----------|
| `sm` | max-w-sm (384px) | Confirmations, simple dialogs, partial payments |
| `md` | max-w-lg (512px) | Create/edit forms (default) |
| `lg` | max-w-xl (576px) | Transaction form, complex forms |

### 3.2 Master-Detail Interaction Scenarios

1. **Nothing selected** → detail panel shows `#empty` slot (icon + "Выберите элемент")
2. **Item clicked** → detail panel shows `#detail` slot with item data
3. **Edit clicked** → `UModal` opens over the entire page (centered with backdrop)
4. **Delete confirmed** → item removed, `selected` resets to null, detail panel returns to `#empty`

### 3.3 Navigation Changes

| Element | Mobile (current) | Desktop (new) |
|---------|-----------------|---------------|
| Tab navigation | BottomNav + slide | SidebarNav + fade |
| List item click | Navigate to /detail/:id | Show in detail panel |
| Add transaction | Full-screen page | UModal (size="lg") |
| Edit entity | Full-screen page | UModal (size="md") |
| Delete confirm | UModal (fullscreen) | UModal (size="sm") |
| Settings pages | Page navigation | Page navigation (unchanged) |

### 3.4 Deep Linking

Detail routes (`/debts/:id`, `/accounts/:id`, etc.) must work on desktop. When a user opens `/debts/123` directly:

- `MasterDetailLayout` reads `route.params.id` and sets it as `selectedId`
- Master panel renders the full list with item 123 highlighted
- Detail panel renders the details for item 123

```ts
const route = useRoute()
const isDesktop = useMediaQuery('(min-width: 1024px)')

// Desktop: extract id from route params, show in detail panel
// Mobile: normal page navigation (unchanged)
```

### 3.5 Key Principles

- **Breakpoint:** `lg: 1024px` — switch to desktop layout
- **Mobile-first preserved:** all mobile styles remain, desktop added via `lg:` prefix
- **Modals:** fullscreen on mobile, centered on desktop — switching logic inside UModal
- **Master-detail:** mobile click = navigation, desktop click = detail panel
- **Content width:** `max-w-7xl` (1280px) centered, consistent across all pages

## Files to Create

| File | Location | Purpose |
|------|----------|---------|
| `PageContainer.vue` | `shared/ui/page-container/` | Max-width wrapper with header slot |
| `MasterDetailLayout.vue` | `shared/ui/master-detail-layout/` | Split-view layout component |

## Files to Modify

| File | Change |
|------|--------|
| `shared/ui/modal/UModal.vue` | Add `size` prop, desktop centered behavior |
| `shared/ui/index.ts` | Export new components |
| `pages/history/HistoryPage.vue` | Wrap in MasterDetailLayout |
| `pages/accounts/AccountsPage.vue` | Wrap in MasterDetailLayout |
| `pages/accounts/AccountDetailPage.vue` | Extract detail content for reuse |
| `pages/debts/DebtsListPage.vue` | Wrap in MasterDetailLayout |
| `pages/debts/DebtDetailPage.vue` | Extract detail content for reuse |
| `pages/goals/GoalsPage.vue` (if exists) | Wrap in MasterDetailLayout |
| `pages/reminders/RemindersListPage.vue` | Wrap in MasterDetailLayout |
| `pages/reminders/ReminderDetailPage.vue` | Extract detail content for reuse |
| `pages/analytics/AnalyticsPage.vue` | Wrap in PageContainer, 4-col stats grid |
| `pages/dashboard/DashboardPage.vue` | Wrap in PageContainer, polish spacing |
| `pages/profile/ProfilePage.vue` | Wrap in PageContainer (max-w-2xl) |

## Out of Scope

- Welcome/Auth pages — no changes
- Tablet-specific layouts (768px–1024px) — existing `md:` breakpoint handling sufficient
- New features or functionality — layout only
- Backend changes — none required
