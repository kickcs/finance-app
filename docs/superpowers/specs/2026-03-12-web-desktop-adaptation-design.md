# Web/Desktop Adaptation Design

**Date:** 2026-03-12
**Status:** Approved
**Scope:** All main pages and features except Welcome/Auth

## Overview

Adapt the mobile-first finance app for desktop (1280px+) using the **Layout Components** approach: create reusable layout components (`PageContainer`, `MasterDetailLayout`) and adapt existing `UModal`. Content components remain unchanged — layout is isolated from content.

**Note:** This adaptation requires creating some new detail-view components (e.g., `TransactionDetailPanel`, `AccountDetailPanel`) that extract and reuse content from existing detail pages. This is layout-driven work — no new features or business logic.

## Decisions

| Decision | Choice |
|----------|--------|
| Target screen size | Desktop 1280px+ |
| Approach | Layout Components (reusable wrappers) |
| Modal behavior on desktop | Sized centered modals (variable width via `size` prop) |
| List page detail view | Master-detail layout (list + detail panel) |
| Master-detail scope | History, Accounts, Debts, Reminders (4 pages) |
| Dashboard changes | Polish existing 8/4 grid, add PageContainer wrapper |
| Content width constraint | max-w-7xl (1280px) centered, consistent across pages |
| Desktop breakpoint | `lg: 1024px` for master-detail and desktop layouts |

## Breakpoint Strategy

The codebase currently uses `md: 768px` for SidebarNav/BottomNav switching and Dashboard grid. This remains unchanged — `md:` continues to control sidebar vs bottom nav.

The new `lg: 1024px` breakpoint is used for **additional** desktop enhancements:
- Master-detail split-view (only activates at `lg:`)
- Enhanced stats grids (4 columns)
- Desktop-specific spacing/padding

**Breakpoint cascade:**
| Width | Layout |
|-------|--------|
| < 768px | Mobile: BottomNav, single column, fullscreen modals |
| 768px–1023px | Tablet: SidebarNav, single column pages, existing Dashboard 8/4 grid |
| >= 1024px | Desktop: SidebarNav + master-detail split-view, enhanced grids |

This is intentional — the 768px–1023px range gets the sidebar but not the split-view, which would be too cramped at that width.

## Section 1: Layout Components

Three components/changes in `shared/ui/`:

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

Split-view for list pages. Desktop: list + detail panel. Mobile: list only, click navigates to detail page.

```vue
<MasterDetailLayout :selected="selectedId" @close="selectedId = null">
  <template #master>
    <TransactionList @select="selectedId = $event" />
  </template>
  <template #detail>
    <TransactionDetailPanel :id="selectedId" />
  </template>
  <template #empty>
    <EmptyState message="Выберите транзакцию" />
  </template>
</MasterDetailLayout>
```

**Props:**
- `selected` — ID of selected item (controls detail panel visibility)

**Events:**
- `close` — emitted when detail panel is closed

**Behavior:**
- `< lg`: renders only `#master` slot, full width. Click triggers router navigation to detail page
- `>= lg`: renders `#master` + divider + `#detail` or `#empty`
- Detail panel shows `#empty` slot when `selected` is null
- Uses Tailwind arbitrary values for proportions: master `flex-[5]`, detail `flex-[4]`

**Header handling:** `MasterDetailLayout` does NOT wrap `PageContainer` internally. Instead, each page provides its own `AppHeader` above the layout, as they do now. `MasterDetailLayout` only handles the split-view area below the header, applying `max-w-7xl mx-auto` to its own container.

```vue
<!-- Page structure -->
<div class="h-full flex flex-col">
  <AppHeader title="История" />
  <MasterDetailLayout :selected="selectedId" class="flex-1">
    <template #master>...</template>
    <template #detail>...</template>
  </MasterDetailLayout>
</div>
```

### 1.3 UModal Adaptation

Existing `UModal` is already a centered dialog with `max-w-md`. The adaptation adds a `size` prop for variable widths on desktop.

```vue
<UModal size="sm">  <!-- Confirmations: max-w-sm (384px) -->
<UModal>            <!-- Default = md: max-w-lg (512px) -->
<UModal size="lg">  <!-- Complex forms: max-w-xl (576px) -->
```

**Changes from current behavior:**
- Add `size` prop that maps to Tailwind max-width classes
- Current `max-w-md` becomes the default `md` size
- No mobile behavior changes — the existing centered dialog works on all screen sizes

## Section 2: Page Adaptations

### 2.1 Dashboard

**Layout:** `PageContainer` wrapper
**Changes:** Minimal — add `max-w-7xl` wrapper, improve `lg:px-8` padding. Existing 8/4 grid (col-span-8 + col-span-4 sticky) stays as-is. `PullToRefresh` is hidden on desktop (`lg:hidden`) — data refreshes via SidebarNav's refresh action or automatic Vue Query refetch.

### 2.2 History

**Layout:** `MasterDetailLayout`
**Master panel:** VirtualGroupedTransactionList with filter tabs (All/Expense/Income/Transfer) and search
**Detail panel:** New `TransactionDetailPanel` component — displays icon, amount, category, account, date, notes + Edit/Delete action buttons. This is a new read-only view component (no business logic — uses existing entity data).
**Edit action:** Opens `UModal` (size="md") with existing EditTransactionModal
**Delete action:** Opens `UModal` (size="sm") with existing ConfirmDeleteModal
**Note:** There is no `/history/:id` route currently. On desktop, transaction selection is handled via component state (`selectedId`), not URL. Deep linking is not needed for transactions.
**SwipeableItem:** Disabled on desktop (`lg:`). Edit/Delete actions are available in the detail panel instead.

### 2.3 Accounts

**Layout:** `MasterDetailLayout`
**Master panel:** Total balance card + draggable account list + "New account" button
**Detail panel:** New `AccountDetailPanel` component — extracts the content from existing `AccountDetailPage` (account header, balance, recent transactions via `useInfiniteAccountTransactions`). Reuses existing widgets.
**Edit action:** Opens `UModal` (size="md") with existing EditAccountModal
**Deep linking:** URL `/accounts/:id` on desktop → `MasterDetailLayout` reads `route.params.id`, highlights account in list, shows detail panel.

### 2.4 Debts

**Layout:** `MasterDetailLayout`
**Master panel:** Debt cards grouped by person or flat, "New debt" button
**Detail panel:** New `DebtDetailPanel` — extracts content from existing `DebtDetailPage` (person, amount, progress bar, payment history + Payment/Edit/Delete actions)
**Payment action:** Opens `UModal` (size="sm") with existing partial payment form
**Deep linking:** URL `/debts/:id` on desktop → selects debt in list, shows in detail panel.

### 2.5 Reminders

**Layout:** `MasterDetailLayout`
**Master panel:** Reminders grouped by today/this week/upcoming
**Detail panel:** New `ReminderDetailPanel` — extracts content from existing `ReminderDetailPage` (amount, date, recurrence, linked account)
**Deep linking:** URL `/reminders/:id` on desktop → selects reminder in list, shows in detail panel.

### 2.6 Analytics

**Layout:** `PageContainer`
**Changes:**
- Stats cards: `grid-cols-2` → `lg:grid-cols-4`
- Charts: use full container width, side-by-side layout for related charts (e.g., daily expenses `flex-[3]` + donut chart `flex-[2]`)
- Sticky filters remain at top
- No master-detail — analytics is a single-pane view

### 2.7 Profile / Settings

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
| List item click | Navigate to /detail/:id | Show in detail panel (no navigation) |
| Add transaction | Full-screen page | Full-screen page (unchanged — refactoring to modal is out of scope) |
| Edit entity | Existing modal | Existing modal with `size` prop |
| Delete confirm | Existing modal | Existing modal with `size="sm"` |
| Settings pages | Page navigation | Page navigation (unchanged) |

### 3.4 Deep Linking

Detail routes (`/debts/:id`, `/accounts/:id`, `/reminders/:id`) work on desktop. When a user opens `/debts/123` directly:

- Page component reads `route.params.id` and passes it as `selectedId` to `MasterDetailLayout`
- Master panel renders the full list with item 123 highlighted
- Detail panel renders the details for item 123

History does not use deep linking for individual transactions — selection is component-state only.

```ts
const route = useRoute()
const selectedId = ref(route.params.id as string | null)

// Watch for route changes to update selection
watch(() => route.params.id, (id) => {
  selectedId.value = id as string ?? null
})
```

### 3.5 Page Transitions on Desktop

Current router uses slide transitions (`slide-forward`, `slide-back`). On desktop (`lg:+`):
- **Main tab navigation** (Home → History → Analytics): `fade` transition instead of `slide`
- **Master-detail selection**: no page transition — detail panel updates in-place
- **Settings sub-pages**: keep current transitions (they're still page navigations)

Implementation: the transition name in `MainLayout`/router can be conditionally set based on `useMediaQuery('(min-width: 1024px)')`.

### 3.6 Key Principles

- **Breakpoints:** `md: 768px` for sidebar/bottom-nav (existing), `lg: 1024px` for master-detail and desktop enhancements (new)
- **Mobile-first preserved:** all mobile styles remain, desktop added via `lg:` prefix
- **Modals:** existing centered behavior + `size` prop for variable widths
- **Master-detail:** mobile click = navigation, desktop click = detail panel
- **Content width:** `max-w-7xl` (1280px) centered, consistent across all pages
- **Touch gestures on desktop:** `SwipeableItem` disabled at `lg:`, `PullToRefresh` hidden at `lg:`

## Files to Create

| File | Location | Purpose |
|------|----------|---------|
| `PageContainer.vue` | `shared/ui/page-container/` | Max-width wrapper with header slot |
| `MasterDetailLayout.vue` | `shared/ui/master-detail-layout/` | Split-view layout component |
| `TransactionDetailPanel.vue` | `entities/transaction/ui/` | Read-only transaction detail view for master-detail |
| `AccountDetailPanel.vue` | `entities/account/ui/` | Account detail view extracted from AccountDetailPage |
| `DebtDetailPanel.vue` | `entities/debt/ui/` | Debt detail view extracted from DebtDetailPage |
| `ReminderDetailPanel.vue` | `entities/reminder/ui/` | Reminder detail view extracted from ReminderDetailPage |

## Files to Modify

| File | Change |
|------|--------|
| `shared/ui/modal/UModal.vue` | Add `size` prop mapping to max-width classes |
| `shared/ui/index.ts` | Export new layout components |
| `pages/history/HistoryPage.vue` | Wrap in MasterDetailLayout, add TransactionDetailPanel |
| `pages/accounts/AccountsPage.vue` | Wrap in MasterDetailLayout, add AccountDetailPanel |
| `pages/accounts/AccountDetailPage.vue` | Extract detail content into AccountDetailPanel |
| `pages/debts/DebtsListPage.vue` | Wrap in MasterDetailLayout, add DebtDetailPanel |
| `pages/debts/DebtDetailPage.vue` | Extract detail content into DebtDetailPanel |
| `pages/reminders/RemindersListPage.vue` | Wrap in MasterDetailLayout, add ReminderDetailPanel |
| `pages/reminders/ReminderDetailPage.vue` | Extract detail content into ReminderDetailPanel |
| `pages/analytics/AnalyticsPage.vue` | Wrap in PageContainer, `lg:grid-cols-4` stats grid |
| `pages/dashboard/DashboardPage.vue` | Wrap in PageContainer, polish spacing, hide PullToRefresh on `lg:` |
| `pages/profile/ProfilePage.vue` | Wrap in PageContainer (max-w-2xl) |
| `app/layouts/ui/MainLayout.vue` | Conditional fade transition on desktop |

## Unchanged Pages

The following pages receive no changes in this adaptation — they are either simple forms, settings pages, or already work adequately at desktop widths:

- `AddTransactionPage` — remains a full-screen page on all sizes
- `AddDebtPage`, `AddReminderPage` — remain as-is
- `FirstAccountPage` (account creation) — remains as-is
- `CurrencySettingsPage`, `CategoriesPage`, `ImportPage`, `QuickActionsSettingsPage` — settings sub-pages, remain as-is
- `DashboardSettingsPage` — remains as-is
- `ScanReceiptPage` — remains as-is
- `ChangelogPage` — remains as-is
- `PeopleListPage` — remains as-is
- Welcome/Auth pages — explicitly out of scope

## Out of Scope

- Welcome/Auth pages — no changes
- Goals page — does not exist as a standalone page (only a dashboard widget); creating it is a separate feature
- Tablet-specific layouts (768px–1024px) — existing `md:` breakpoint handling sufficient
- Refactoring AddTransactionPage into a modal — too complex, keep as page
- Keyboard shortcuts / keyboard navigation within master-detail
- Backend changes — none required
