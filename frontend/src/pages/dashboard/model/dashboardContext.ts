import { type ComputedRef, type InjectionKey, type Ref, inject, provide } from 'vue';
import type { AccountWithBalances } from '@/entities/account';
import type { CategoryBreakdown, Transaction } from '@/entities/transaction';
import type { BudgetCurrentResponse } from '@/entities/budget';
import type { Category } from '@/entities/category';
import type { Debt } from '@/entities/debt';
import type { RecurringSubscription } from '@/entities/recurring-subscription';
import type { WidgetId } from '@/shared/api/database.types';
import type { QuickAction } from '@/features/configure-quick-action';
import type { HintConfig } from '@/features/feature-hints';
import type { useDashboardNavigation } from './useDashboardNavigation';

export interface DashboardCategoryMeta {
  name: string;
  icon: string;
  color: string;
}

export interface DashboardContext {
  // Money / metrics
  totalBalance: ComputedRef<number>;
  currency: ComputedRef<string>;
  avgDailyExpense: ComputedRef<number | null>;
  safeDailyLimit: ComputedRef<number | null>;
  daysRemainingInMonth: ComputedRef<number>;

  // Collections
  visibleAccounts: ComputedRef<AccountWithBalances[]>;
  hiddenAccountCount: ComputedRef<number>;
  recentTransactions: Ref<Transaction[]>;
  categoryBreakdown: Ref<CategoryBreakdown[]>;
  debts: Ref<Debt[]>;
  budget: Ref<BudgetCurrentResponse | null>;
  upcomingSubscriptions: Ref<RecurringSubscription[]>;

  // Category resolver (shared getCategoryById from useCategories,
  // falls back to the static one-per-user list when nothing is loaded yet)
  getCategoryById: (id: string) => Category | undefined;

  // Quick actions
  quickActionSlots: Ref<(QuickAction | null)[]>;
  quickActionsHidden: Ref<boolean>;
  quickActionsHintDismissed: Ref<boolean>;
  categoryMap: ComputedRef<Map<string, DashboardCategoryMeta>>;

  // Identity / preferences
  userId: Ref<string | null>;
  isHidden: Ref<boolean>;
  isCompactMode: Ref<boolean>;

  // Currency conversion (cached, shared across widgets)
  convert: (amount: number, fromCurrency: string) => number;

  // Widget configuration
  widgetOrder: ComputedRef<WidgetId[]>;
  hiddenWidgets: ComputedRef<Set<WidgetId>>;

  // Loading flags
  accountsLoading: Ref<boolean>;
  ratesLoading: Ref<boolean>;
  analyticsLoading: Ref<boolean>;
  recentTxLoading: Ref<boolean>;
  debtsLoading: Ref<boolean>;
  budgetLoading: Ref<boolean>;
  quickActionsLoading: Ref<boolean>;
  subscriptionsLoading: Ref<boolean>;
  balanceLoading: ComputedRef<boolean>;

  // Settings hint (for standard layout footer)
  showSettingsDot: ComputedRef<boolean>;
  showSettingsHint: Ref<boolean>;
  settingsHintConfig: HintConfig | null;

  // Refresh
  scrollContainerRef: Ref<HTMLElement | null | undefined>;
  onRefresh: () => Promise<void>;

  // Navigation
  nav: ReturnType<typeof useDashboardNavigation>;

  // Handlers
  toggleHidden: () => void;
  toggleCompactMode: () => void;
  openBudgetSheet: () => void;
  openFinancialPeriodModal: () => void;
  openDashboardSettings: () => void;
  dismissSettingsHint: () => void;
  handleSettingsHintAction: () => void;
  handleQuickActionClick: (action: QuickAction | null) => void;
  handleQuickActionLongPress: (action: QuickAction | null) => void;
  dismissQuickActionsHint: () => void;
}

const DASHBOARD_CONTEXT_KEY: InjectionKey<DashboardContext> = Symbol('DashboardContext');

export function provideDashboardContext(ctx: DashboardContext): void {
  provide(DASHBOARD_CONTEXT_KEY, ctx);
}

export function useDashboardContext(): DashboardContext {
  const ctx = inject(DASHBOARD_CONTEXT_KEY);
  if (!ctx) {
    throw new Error('useDashboardContext must be called inside a component that provides it');
  }
  return ctx;
}
