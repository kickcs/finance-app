# Mobile (Expo) vs Frontend (Vue) Parity Audit — Design

**Date:** 2026-05-26
**Source of truth:** `frontend/` (Vue 3 + FSD)
**Target of comparison:** `mobile/` (Expo Router + RN)
**Related:** `docs/superpowers/plans/2026-05-25-vue-to-expo-migration.md`, `docs/superpowers/specs/2026-05-25-vue-to-expo-migration-design.md`

## 1. Goal

Produce an exhaustive, per-page map of divergences between the Vue web frontend and the Expo mobile app, sufficient to drive a follow-up implementation plan that closes parity gaps. Frontend is the authoritative reference; mobile is evaluated for what it is missing or implements differently.

This spec is a **data artifact**, not an implementation. Its only consumer is the writing-plans skill, which will turn the gap list into ordered, executable tasks.

## 2. Scope

**In scope**
- All 26 routes declared in `frontend/src/app/router/index.ts`.
- For each page: feature parity, behaviour/UX parity, visual/native divergence, severity rating.
- Cross-cutting appendix: shared/ui, entity API composables, format/lib utilities, navigation patterns, design tokens.
- Accepted divergences (native-iOS patterns that are intentionally different from web).

**Out of scope**
- Backend / API changes (mobile reuses the same NestJS API).
- Implementation of any gap (handled by the plan).
- Test coverage comparison (mobile has no e2e yet).
- Pixel-level visual diffing — visual notes are at the component / token / pattern level.

## 3. Methodology

For each page:
1. Read the frontend route definition + page entry component.
2. Enumerate its imports from `@/widgets`, `@/features`, `@/entities`, `@/shared`.
3. Find the corresponding mobile route under `mobile/src/app/` (Expo Router file-based).
4. If the mobile route exists, enumerate its imports.
5. Compute three gap classes:
   - **Functional gaps** — widget/feature/composable used by frontend, not used by mobile.
   - **Behaviour gaps** — different state-management or pagination or interaction model that affects what the user can do (e.g., `useInfiniteTransactions` vs basic `useTransactions`).
   - **Visual / native divergence** — UI primitives that differ in a way that changes UX (modal vs full-screen sheet, MasterDetailLayout vs Stack, swipe vs alert).
6. Assign a severity tag:
   - **P0** — blocking parity; user cannot do something they can do on the web.
   - **P1** — significant UX gap or polish missing for release.
   - **P2** — minor / web-only feature or already covered by an accepted native pattern.

Inventory data was collected via a single Explore-agent pass on 2026-05-26. The raw inventory was condensed into this spec; if a per-page note seems thin, the inventory file holds the source-import lists.

## 4. Severity Legend

| Tag | Meaning | Plan action |
|---|---|---|
| **P0** | Parity-blocking. Mobile user cannot perform a core action available on web. | Must close before release. |
| **P1** | Major gap (entire side-feature, important UX) but not blocking core flow. | Should close before release. |
| **P2** | Web-only (PWA, drag-reorder, demo mode), minor polish, or accepted native pattern. | Optional / explicitly deferred. |
| **A** | Accepted divergence — intentional native pattern, not a gap. | Documented, no work. |

## 5. Per-Page Audit

### 5.1 dashboard
- **Frontend:** `/` → `pages/dashboard/DashboardPage.vue`. Composes `MasterDetailLayout`, `BalanceCard`, `AccountStack`, `RecentTransactions`, `SaveSpendSection`, `DebtsSection`, `GoalsSection`, `BudgetSection`, `RemindersSection`, `UpcomingSubscriptions`, `QuickActionModal`, `InstallPwaBanner`, `SetBudgetSheet`, `FinancialPeriodModal`, `useDashboardData`, `useDashboardQuickActions`, `useFeatureHints`, `usePwaUpdateToast`.
- **Mobile:** `(tabs)/index.tsx`. Composes `BalanceCard`, `AccountStack`, `RecentTransactions`, `SaveSpendSection`, `usePullToRefresh`.
- **Functional gaps (P0):** Quick actions modal trigger, budget section + `SetBudgetSheet`, financial period modal/config, dashboard widget reorder/visibility (relies on profile `dashboardSettings`), upcoming subscriptions section, debts section on dashboard, goals section, reminders section.
- **Functional gaps (P1):** Feature hints onboarding, `useDashboardQuickActions` configuration entry point.
- **Functional gaps (P2):** PWA install banner / modal / update toast — **A** (PWA does not apply to native).
- **Behaviour gaps (P1):** Cache invalidation orchestration on focus (`invalidateTransactionRelated`/`invalidateAccountRelated`/`invalidateSubscriptionRelated`). Mobile relies only on pull-to-refresh, no event-driven invalidation.
- **Visual / native divergence (A):** Desktop `MasterDetailLayout` is web-only; mobile's `ScrollView + RefreshControl` is the native equivalent.

### 5.2 analytics
- **Frontend:** `/analytics` → `pages/analytics/AnalyticsPage.vue`. Uses `IncomeExpenseBar`, `DailyStatsCards`, `DonutChart`, `DailyExpenseChart`, `PeriodComparison`, `SpendingPaceChart`, `FilterChips`, `SwipeablePeriodHeader`, `useAnalyticsFilters`, `useConvertedAnalytics`, `usePeriodNavigation`, `useDailyStats`, `useBudget`, `useFinancialPeriod`.
- **Mobile:** `(tabs)/analytics.tsx`. Uses `useAnalyticsStats`, `useProfile`, `formatCurrency` — renders income/expense/net only.
- **Functional gaps (P0):** Donut chart (category breakdown), daily expense chart, daily stats cards, period comparison chart, spending pace chart, filter chips (account / category), swipeable period header / period navigation, multi-currency converted view (`useConvertedAnalytics`), budget integration in analytics.
- **Behaviour gaps (P0):** Period scale switching (day/week/month/year), financial-period-aware analytics window, multi-currency aggregation.
- **Visual / native divergence (A):** Web `MasterDetailLayout` not applicable.

### 5.3 accounts (list)
- **Frontend:** `/accounts` → `pages/accounts/AccountsPage.vue`. Uses `AccountCard`, `AccountDetailPanel` (desktop split-view), `EditAccountModal`, `DeleteAccountModal`, `useEditAccount`, `vuedraggable`, `useExchangeRates`, transaction preview query per account.
- **Mobile:** `/accounts/index.tsx`. Uses `AccountCard`, `useAccountsWithBalances`, `usePullToRefresh`. Tap → navigates to detail screen.
- **Functional gaps (P0):** Edit account flow (modal on web, missing on mobile list; mobile uses separate detail-edit screen — verify in 5.4), delete account flow.
- **Functional gaps (P1):** Account reordering via drag-and-drop, per-account transaction preview in list, multi-currency exchange-rate display in totals row.
- **Visual / native divergence (A):** Master/detail split is desktop-only; mobile push-navigation is the native equivalent.

### 5.4 accounts/[id] (detail)
- **Frontend:** `/accounts/:id` → `pages/accounts/AccountDetailPage.vue`. `VirtualGroupedTransactionList`, `useInfiniteAccountTransactions`, `useGroupedTransactions`, `EditAccountModal`, `DeleteAccountModal`, `EditTransactionModal`, `DeleteTransactionModal`, `useTransactionEditFlow`, `AdjustBalanceModal`, `useAdjustBalance`, account type label, set-default-account.
- **Mobile:** `/accounts/[id]/index.tsx`. `SectionList`, `useInfiniteAccountTransactions`, `useGroupedTransactions`, `useDeleteTransaction`, `SwipeableRow`, `Alert` for delete. Adjust-balance lives at a separate route `/accounts/[id]/adjust`.
- **Functional gaps (P0):** Edit account from detail screen, delete account, edit transaction (mobile only deletes via swipe), set-default-account toggle.
- **Functional gaps (P1):** Account type label rendering.
- **Behaviour gaps (P1):** Web uses modal-based edit flow with `useTransactionEditFlow`; mobile only supports delete-via-swipe + alert confirm. Adjust-balance is at a separate route on mobile (works, but no parity with web's in-detail modal).
- **Visual / native divergence (A):** `VirtualGroupedTransactionList` (web) vs `SectionList` (native); `SwipeableRow` + `Alert` is an accepted native delete pattern.

### 5.5 transactions/new
- **Frontend:** `/transactions/new` → `pages/transactions/new/AddTransactionPage.vue`. `TransactionForm`, `useTransactionForm`, `useSubmitTransaction`, `useSplitExpense`.
- **Mobile:** `/transactions/new.tsx`. `TransactionForm`, `useProfile`, `useAccounts`.
- **Functional gaps (P0):** Split-expense flow (`useSplitExpense`) and associated debt creation pipeline.
- **Behaviour gaps (P1):** Verify mobile `TransactionForm` covers all frontend `TransactionForm` modes (transfer, exchange-rate, commission, adjustment).

### 5.6 history (transactions list)
- **Frontend:** `/history` → `pages/history/HistoryPage.vue`. `VirtualGroupedTransactionList`, `TransactionDetailPanel`, `useInfiniteTransactions`, `useGroupedTransactions`, `SearchInput`, `useServerSearch`, `EditTransactionModal`, `DeleteTransactionModal`, `useTransactionEditFlow`, `AccountSelector`, `CategoryChips`, `UTabs` (income/expense filter), `useHistoryFilters`, `useBalanceAfter`, `computeDayTotal`, `MasterDetailLayout`.
- **Mobile:** `(tabs)/history.tsx`. `SectionList`, `useInfiniteTransactions`, `useGroupedTransactions`, `useDeleteTransaction`, `usePullToRefresh`, `SwipeableRow`, `Alert`.
- **Functional gaps (P0):** Server-side search bar, type filter (income/expense/all), account selector filter, category filter chips, edit transaction flow, transaction detail panel, balance-after column.
- **Behaviour gaps (P1):** `useHistoryFilters` URL-state filter persistence; mobile has none.
- **Visual / native divergence (A):** Detail panel via `MasterDetailLayout` is desktop-only.

### 5.7 debts (list)
- **Frontend:** `/debts` → `pages/debts/list/DebtsListPage.vue`. `DebtCard`, `DebtDetailPanel`, `ClosedDebtCard`, `UTabs` (direction filter), `CollapsibleRoot/Trigger/Content` (open/closed sections), `SelectChips` (currency filter), `CloseAllDebtsModal`, `DeleteDebtModal`, `PartialPaymentModal`, `PullToRefresh`, `useIntersectionObserver` (pagination), `useDebtsPageState`.
- **Mobile:** `/debts/index.tsx`. `SectionList`, `DebtCard`, `useInfiniteDebts`.
- **Functional gaps (P0):** Direction tabs (owed/lent), currency filter chips, open/closed sections (collapsible), close-all-debts action, partial-payment modal at list level, pull-to-refresh.
- **Behaviour gaps (P0):** `useDebtsPageState` (active tab + currency filter URL state); mobile has flat list with no filtering.
- **Visual / native divergence (A):** MasterDetailLayout web-only; CollapsibleRoot → could become a `SectionList` header toggle on native (decision item).

### 5.8 debts/[id] (detail)
- **Frontend:** `/debts/:id` → `pages/debts/detail/DebtDetailPage.vue`. `DebtDetailContent`, `useDebtTransactions`, `DeleteDebtModal`, `useCloseDebt`, `PartialPaymentModal`, `usePartialPayment`, `EditDebtDrawer`.
- **Mobile:** `/debts/[id]/index.tsx`. `useDebt`, `useDeleteDebt`, `formatCurrency`, `Card`. Edit / close / partial-pay at separate routes `/debts/[id]/edit`, `/debts/[id]/close`, `/debts/[id]/partial-pay` (verify all three exist).
- **Functional gaps (P0):** Debt transactions list (`useDebtTransactions`), `DebtDetailContent` widget.
- **Behaviour gaps (P1):** Web uses modals/drawer over the detail page; mobile uses dedicated full-screen routes — **A** for the routing pattern, but verify all three sibling routes exist with full forms.

### 5.9 debts/new
- **Frontend:** `/debts/new` → redirects to `/debts` (placeholder; debt creation happens via a modal/drawer on the list page).
- **Mobile:** No corresponding entry under `mobile/src/app/debts/`. Mobile has `create-debt` feature under `mobile/src/features/`.
- **Functional gaps (P1):** Verify mobile's create-debt feature is reachable from `/debts` list (FAB / header button) and has parity with the web create-debt drawer (currency, person, account, amount, due-date, type).

### 5.10 profile
- **Frontend:** `/profile` → `pages/profile/ProfilePage.vue`. `EditProfileModal`, `useChangelog`, `InstallPwaModal`, `usePwaInstall`, `useSubscription`, `PLAN_LABELS`, `usePremiumFeature`, `usePwaUpdate`, `usePrimaryColor`, `FinancialPeriodModal`, `useFinancialPeriod`, `NotificationSettings`, `ThemeToggle`, `NavbarStyleSelector`, `getInitial`.
- **Mobile:** `(tabs)/profile.tsx`. `useSubscription`, `ThemeToggle`, `signOut`.
- **Functional gaps (P0):** Edit profile (name, currency hint, avatar), subscription details panel + manage subscription, financial period config, push notification settings.
- **Functional gaps (P1):** Primary color selector entry, navbar style selector, changelog entry link.
- **Functional gaps (P2):** PWA install / update — **A** (native irrelevant).

### 5.11 subscriptions (list)
- **Frontend:** `/subscriptions` → `pages/subscriptions/SubscriptionsPage.vue`. `SubscriptionCalendar`, `SubscriptionListItem`, `useRecurringSubscriptions`, `daysUntilBilling`, `SearchInput`.
- **Mobile:** Missing entirely.
- **Functional gaps (P0):** Entire recurring-subscriptions feature absent on mobile: list, calendar view, search, per-item card.

### 5.12 subscription-detail
- **Frontend:** `/subscriptions/new` and `/subscriptions/:id` → `pages/subscription-detail/SubscriptionDetailPage.vue`. `SubscriptionForm`, `EditSubscriptionForm`, `useCreateSubscription`.
- **Mobile:** Missing entirely.
- **Functional gaps (P0):** Create / edit recurring subscription flow.

### 5.13 settings (hub)
- **Frontend:** Settings is reached from `ProfilePage.vue` and from dedicated routes (`/settings/currency`, `/settings/categories`, `/settings/quick-actions`, `/settings/color`, `/settings/import`, `/dashboard/settings`).
- **Mobile:** No central settings hub; `(tabs)/profile.tsx` links to a subset (currency, import).
- **Functional gaps (P1):** Decide whether to add a settings hub screen or surface each section from profile (mobile-natural pattern). Mark **A** for the hub-vs-flat decision once chosen — but the per-section gaps in 5.14–5.18 are real.

### 5.14 settings/categories
- **Frontend:** `/settings/categories` → `CategoriesPage.vue`. `CategoryForm`, `useManageCategories`, `useCategoriesPage`, sliding-indicator tabs, `vuedraggable` reorder, `SwipeableItem`.
- **Mobile:** Missing.
- **Functional gaps (P0):** Category management screen (create / edit / delete / reorder, expense vs income tabs).

### 5.15 settings/currency
- **Frontend:** `/settings/currency` → `CurrencySettingsPage.vue`. Sets profile currency **and** manages the list of account currencies via localStorage.
- **Mobile:** `/settings/currency.tsx`. Sets profile currency only via `useSetCurrency`.
- **Functional gaps (P1):** Manage which currencies appear in account-balance UI (frontend's localStorage-driven list).

### 5.16 settings/quick-actions
- **Frontend:** `/settings/quick-actions` → `QuickActionsSettingsPage.vue`. `QuickActionModal`, `useQuickActions`, `MAX_SLOTS`, drag-reorder.
- **Mobile:** Missing.
- **Functional gaps (P0):** Quick-actions configuration (slot selection, reorder, per-slot account+category binding).

### 5.17 settings/color
- **Frontend:** `/settings/color` → `PrimaryColorPage.vue`. reka-ui `ColorSwatchPicker`, `usePrimaryColor`, `PRIMARY_COLORS`.
- **Mobile:** Missing.
- **Functional gaps (P2):** Primary color theming. Lower priority than P0 features but should be present if theming is desired on mobile.

### 5.18 dashboard-settings
- **Frontend:** `/dashboard/settings` → `DashboardSettingsPage.vue`. Toggles widget visibility and orders widgets via drag; persists in profile `dashboardSettings`.
- **Mobile:** Missing.
- **Functional gaps (P1):** Without this, mobile cannot reorder/hide dashboard sections. Closing this is dependent on first having the missing dashboard sections (5.1).

### 5.19 scan-receipt
- **Frontend:** `/scan-receipt` → `ScanReceiptPage.vue`. `useReceiptWizard`, `Step1PhotoCapture` … `Step4Summary`, `StepProgressIndicator`.
- **Mobile:** `/scan-receipt.tsx` exists (96 B — verify content). Mobile has `features/scan-receipt/`.
- **Functional gaps (P0/P1):** Verify all 4 wizard steps exist on mobile, including assign-participants flow (uses `people` entity which is missing on mobile — see 5.20). Until people exists, step 3 cannot work.

### 5.20 people
- **Frontend:** `/people` → `PeopleListPage.vue`. `usePeople`, `InitialAvatar`, `UColorPicker`, `ENTITY_COLORS`, `SwipeableItem`, `ConfirmDeleteModal`.
- **Mobile:** Missing.
- **Functional gaps (P0):** Entire people-management screen. Blocks split-expense (5.5) and scan-receipt step 3 (5.19).

### 5.21 settings/import
- **Frontend:** `/settings/import` → `ImportPage.vue`. `useImportWizard` (multi-step CSV import).
- **Mobile:** `/settings/import.tsx`. `DocumentPicker` + `FileSystem` + `parseMoneyLoverCsv`, basic preview.
- **Functional gaps (P1):** Wizard step state (preview → map → confirm → import), error reporting per row, mapping UI. Mobile currently parses and previews but does not import in a guided flow.

### 5.22 onboarding/welcome
- **Frontend:** `/welcome` → `WelcomePage.vue`. Lazy-loaded marketing sections, scroll-progress.
- **Mobile:** Not present (mobile likely sends unauthenticated users straight to sign-in).
- **Functional gaps (P2/A):** Marketing welcome page is web-acquisition surface; on mobile the app-store listing serves the same purpose. Mark **A** unless product wants a first-launch tour.

### 5.23 onboarding/first-account
- **Frontend:** `/onboarding/first-account` → `FirstAccountPage.vue`. `AccountForm`, `useCreateAccount`, sets `profile.hasCompletedOnboarding`.
- **Mobile:** Verify behaviour — `mobile/src/app/accounts/new.tsx` exists. The question is whether mobile checks `hasCompletedOnboarding` and force-routes to first-account creation.
- **Functional gaps (P0):** Confirm onboarding gate is implemented in mobile router (e.g., `_layout.tsx` redirect when profile has no accounts).

### 5.24 auth/login
- **Frontend:** `/auth/login` → `LoginPage.vue`. Email/password + `DemoSetupScreen` + `useDemoSetup`.
- **Mobile:** `/auth/sign-in.tsx` and (verify) `/auth/sign-up.tsx`.
- **Functional gaps (P1):** Demo mode entry point — confirm presence on mobile, since project mentions `demo-mode` only as a frontend feature.
- **Behaviour gaps (P1):** Validation, error states — verify parity.

### 5.25 auth/callback
- **Frontend:** `/auth/callback` — placeholder for OAuth that is not implemented backend-side.
- **Mobile:** Missing.
- **A:** Skip until OAuth is added to the backend.

### 5.26 changelog
- **Frontend:** `/changelog` → `ChangelogPage.vue`. `useChangelog`, `ChangelogEntryItem`.
- **Mobile:** Missing.
- **Functional gaps (P1):** Changelog screen + entry from profile.

## 6. Cross-Cutting Appendix

### 6.1 shared/ui parity

Frontend exposes ~25 named components from `frontend/src/shared/ui/`. Mobile exposes ~8 (`Button`, `Card`, `Icon`, `Input`, `Skeleton`, `Spinner`, `SwipeableRow`, plus a few utilities).

| Frontend component | Mobile status | Severity |
|---|---|---|
| Badge | Missing | P1 |
| ColorPicker | Missing | P2 |
| ConfirmDeleteModal | Replaced by `Alert` (native) | A |
| DiscoveryDot | Missing | P2 |
| EmptyState | Missing as shared; ad-hoc per screen | P1 |
| IconBadge | Missing | P1 |
| IconSelector | Missing | P1 (blocks category form) |
| InitialAvatar | Missing | P1 (blocks people, profile) |
| MasterDetailLayout | Web-only | A |
| Modal | Replaced by native sheets / full screens | A |
| NavigationProgress | Missing | P2 |
| NotFoundState | Missing | P2 |
| PageContainer | Missing | P2 |
| ProgressBar | Missing | P1 (blocks goals, debts UI) |
| PullToRefresh (as shared component) | Replaced by `usePullToRefresh` + `RefreshControl` | A |
| SectionHeader | Missing | P1 |
| SelectChips | Missing | P1 (blocks debts currency filter, history filters) |
| Tabs | Missing | P0 (blocks debts direction filter, categories, history) |
| Toggle | Missing | P1 |
| reka-ui primitives (CollapsibleRoot, ColorSwatchPicker, etc.) | Web-only | A; needs RN equivalents for sections that depend on them |

### 6.2 Entity API composables

| Entity | Frontend composables | Mobile composables | Gap |
|---|---|---|---|
| account | useAccounts, useAccount, useEditAccount | useAccountsWithBalances, useAccount | useEditAccount, account reorder mutation, transactions-preview query |
| transaction | useTransactions, useInfiniteTransactions, useRecentTransactions, useInfiniteAccountTransactions, useMonthlyStats, useDailyStats, useGroupedTransactions, useTransactionEditFlow, useSplitExpense, useServerSearch, useBalanceAfter | useTransactions, useInfiniteTransactions, useDeleteTransaction, useInfiniteAccountTransactions, useGroupedTransactions, useAnalyticsStats | useTransactionEditFlow, useSplitExpense, useServerSearch, useBalanceAfter, useMonthlyStats, useDailyStats, useRecentTransactions |
| debt | useDebts, useInfiniteDebts, useDebtTransactions, useCloseDebt, usePartialPayment | useInfiniteDebts, useDebt, useDeleteDebt | useDebtTransactions, useCloseDebt, usePartialPayment (verify mobile equivalents under features/) |
| category | useCategories, useManageCategories | useCategories | useManageCategories (CRUD + reorder) |
| subscription | useSubscription, useRecurringSubscriptions, useCreateSubscription | useSubscription | useRecurringSubscriptions, useCreateSubscription |
| budget | useBudget | — | useBudget entirely |
| goal | useGoals | useGoals, useGoal | — (goal pages live only on mobile; consider whether to also surface on web) |
| person | usePeople | — | usePeople entirely |
| push-subscription | exists | — | entire push entity (mobile uses Expo Notifications differently — see 6.5) |
| quick-action | useQuickActions | — | useQuickActions configuration |
| recurring-subscription | useRecurringSubscriptions | — | as above |

### 6.3 Composables (shared)

| Hook | Frontend | Mobile | Note |
|---|---|---|---|
| useToast | ✓ | — | Mobile uses `Alert` for confirmations; needs a real toast for non-blocking notifications (P1) |
| usePullToRefresh | — (uses component) | ✓ | OK |
| usePremiumFeature | ✓ | likely ✓ (verify) | Must exist for paywall to work; check `useSubscription` wrapper on mobile |
| useFinancialPeriod | ✓ | — | Required by analytics + dashboard period scope (P0) |
| useExchangeRates | ✓ | — | Required by analytics, accounts, multi-currency (P0) |
| useIsDesktop | ✓ | N/A | A |
| useNavbarStyle | ✓ | — | Tied to bottom-nav style settings (P2) |
| useHaptics | ✓ (wrapping web-haptics) | ✓ (bare `trigger`) | Different API; align if shared signatures matter |
| usePwaUpdate / usePwaInstall | ✓ | — | A |
| useAsyncOperation | ✓ | — | Light helper; replicate if needed (P2) |
| useMountedAnimation | ✓ | — | Animation helper for in-view transitions (P2) |
| useChangelog | ✓ | — | Needed for 5.26 (P1) |
| useDemoSetup | ✓ | — | Needed for 5.24 demo entry (P1) |

### 6.4 Format / utils

Mobile mirrors `format/currency`, `format/date`. Missing:

- `format/greeting.ts` (welcome card on dashboard)
- `format/pluralize.ts` (Russian pluralization used in debt lists, etc.)
- `format/text.ts::getInitial` (avatar fallback)
- `format/intlCache.ts` (Intl reuse — not user-visible)

CSV parsing and haptics are present on mobile.

### 6.5 Push notifications

Frontend has a `push-subscription` entity backed by VAPID + service worker. Mobile must use a different transport (Expo Notifications + APNs/FCM token registration). Treat backend reuse as **out of scope** here; flag as **A** for the underlying mechanism, but the *user-visible* "Push notification settings" screen on mobile is a gap (P1, see 5.10 profile).

### 6.6 Navigation patterns

| Pattern | Frontend | Mobile | Verdict |
|---|---|---|---|
| Master/detail | `MasterDetailLayout` | Push navigation (Stack) | A |
| Modals | `UModal` over current page | Native sheets / dedicated routes | A |
| Pull-to-refresh | `PullToRefresh` component | `RefreshControl` via `usePullToRefresh` | A |
| Swipe-to-delete | `SwipeableItem` | `SwipeableRow` + `Alert` | A |
| Bottom navigation | Custom `BottomNav` | Expo Router native tabs | A |

## 7. Accepted Divergences (Catalog)

These do **not** appear in the plan as work items:

1. PWA install banner, install modal, update toast.
2. `MasterDetailLayout` (desktop-only) → native stack push.
3. `UModal` overlays on the current page → native sheets / dedicated routes (used by debts edit/close/partial-pay, account adjust).
4. Web-only `ConfirmDeleteModal` → `Alert.alert` on native.
5. reka-ui primitives that have no RN equivalent (CollapsibleRoot, ColorSwatchPicker) → idiomatic native UI for the same purpose.
6. `useToast` web implementation differs from any native one — alignment on API, not implementation.
7. OAuth callback page (backend doesn't support OAuth yet).
8. Welcome marketing page (mobile-acquisition is the App Store listing).

## 8. Open Questions

These need product/UX decisions before the plan can be finalized:

1. **Settings hub on mobile** — single screen or scattered entries from profile? (Affects 5.13.)
2. **CollapsibleRoot replacement** — accept a flat list with section headers, or implement a native collapsible? (Affects 5.7.)
3. **Goals on web** — goals currently exist only on mobile. Should web also surface a goals page? (Out of this audit's strict scope but worth flagging.)
4. **Push notification scope** — full parity (subscribe / unsubscribe / per-category opt-in), or MVP (system permission + reminders only)?
5. **Demo mode on mobile** — needed for App Store review or skip?
6. **Welcome screen on mobile** — first-launch onboarding tour, yes/no?

## 9. Output Structure for the Plan

The follow-up plan should be organised so each P0 / P1 page or appendix item becomes one task with:

- A scoped acceptance criterion ("user can do X on mobile, matching web behaviour Y").
- A pointer to the relevant frontend reference component(s).
- A note on accepted native divergence (so the implementer doesn't try to copy the web UI 1:1).

Suggested task ordering for the plan:
1. Shared/ui primitives that block multiple screens (Tabs, SelectChips, SectionHeader, EmptyState, ProgressBar, InitialAvatar, IconBadge, Toggle).
2. Cross-cutting composables (useExchangeRates, useFinancialPeriod, useToast).
3. People entity + UI (unblocks scan-receipt step 3 and split-expense).
4. Dashboard sections parity (debts/goals/budget/reminders/upcoming-subscriptions).
5. Analytics charts + filters + period navigation.
6. History filters + search + edit transaction.
7. Debts list filters + sections + close-all + partial-payment from list.
8. Accounts edit / delete / reorder, account-detail edit flows.
9. Recurring subscriptions feature (list, detail, calendar).
10. Categories management.
11. Quick-actions configuration.
12. Dashboard customization.
13. Profile sub-screens (edit profile, financial period, notification settings, changelog, primary color, navbar style).
14. Onboarding gate (first-account check), demo mode entry.

This ordering follows dependency direction (shared primitives → entity APIs → page-level features) and severity (P0 before P1 before P2).
