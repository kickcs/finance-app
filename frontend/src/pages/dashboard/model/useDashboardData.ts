import { computed } from 'vue';
import { useTimestamp } from '@vueuse/core';
import { useAccounts } from '@/entities/account';
import { useRecentTransactions, useAnalyticsStats } from '@/entities/transaction';
import { useDebts } from '@/entities/debt';
import { useReminders } from '@/entities/reminder';
import { useCategories } from '@/entities/category';
import { useBudget } from '@/entities/budget';
import { useProfile, useExchangeRates } from '@/shared/api';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { toLocalISODate } from '@/shared/lib/date';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
import type { WidgetId } from '@/shared/api/database.types';
import { DEFAULT_WIDGET_ORDER } from '@/shared/config/dashboard';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';

const MIN_DAYS_FOR_SPENDING_METRICS = 7;

export function useDashboardData() {
  const { user, userId } = useCurrentUser();
  const { profile } = useProfile(userId);
  const currency = computed(() => profile.value?.currency ?? DEFAULT_CURRENCY);
  const { convert, isLoading: ratesLoading } = useExchangeRates(currency);

  const { accounts, isLoading: accountsLoading } = useAccounts(userId);
  const { debts, isLoading: debtsLoading } = useDebts(userId);
  const { reminders, isLoading: remindersLoading } = useReminders(userId);
  const {
    budget,
    isLoading: budgetLoading,
    isSaving: budgetSaving,
    setDefault,
    setOverride,
    removeOverride,
  } = useBudget(userId);
  const { expenseCategories, allCategories } = useCategories(userId);
  const { transactions: recentTransactions, isLoading: recentTxLoading } = useRecentTransactions(
    userId,
    10,
  );

  // Reactive timestamp — keeps day calculations and month boundaries fresh across midnight
  const timestamp = useTimestamp({ interval: 60_000 });
  const currentDate = computed(() => new Date(timestamp.value));

  // Current month analytics (reactive — re-queries on month boundary)
  const monthStart = computed(() => {
    const d = currentDate.value;
    return toLocalISODate(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const monthEnd = computed(() => {
    const d = currentDate.value;
    return toLocalISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  });
  const {
    categoryBreakdown,
    expenseByCurrency,
    isLoading: analyticsLoading,
  } = useAnalyticsStats({
    startDate: monthStart,
    endDate: monthEnd,
  });

  const userName = computed(() => {
    const fullName = profile.value?.name || user?.value?.name;
    if (!fullName) return '';
    return fullName.split(' ')[0];
  });

  // Dashboard customization settings
  const dashboardSettings = computed(() => profile.value?.dashboard_settings ?? null);

  const widgetOrder = computed<WidgetId[]>(() => {
    const saved = dashboardSettings.value?.widget_order;
    if (!saved) return DEFAULT_WIDGET_ORDER;
    const missing = DEFAULT_WIDGET_ORDER.filter((id) => !saved.includes(id));
    return missing.length > 0 ? [...saved, ...missing] : saved;
  });

  const hiddenWidgets = computed<Set<WidgetId>>(
    () => new Set(dashboardSettings.value?.hidden_widgets ?? []),
  );

  const hiddenAccountIds = computed<Set<string>>(
    () => new Set(dashboardSettings.value?.hidden_account_ids ?? []),
  );

  const visibleAccounts = computed(() =>
    accounts.value.filter((a) => !hiddenAccountIds.value.has(a.id)),
  );

  const hiddenAccountCount = computed(() => accounts.value.length - visibleAccounts.value.length);

  const totalBalance = computed(() => {
    const filteredByCurrency: Record<string, number> = {};
    for (const account of visibleAccounts.value) {
      for (const balance of account.balances) {
        filteredByCurrency[balance.currency] =
          (filteredByCurrency[balance.currency] ?? 0) + balance.balance;
      }
    }
    let total = 0;
    for (const [curr, amount] of Object.entries(filteredByCurrency)) {
      total += convert(amount, curr);
    }
    return total;
  });

  const { currentBounds, daysRemaining } = useFinancialPeriod();
  const daysElapsedInMonth = computed(() => {
    const start = currentBounds.value.start;
    const today = currentDate.value;
    const diffMs = today.getTime() - start.getTime();
    return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
  });
  const daysRemainingInMonth = computed(() => daysRemaining.value);

  // Show spending metrics only after the first week of the month (7+ days of data)
  const showSpendingMetrics = computed(
    () => daysElapsedInMonth.value >= MIN_DAYS_FOR_SPENDING_METRICS,
  );

  // Monthly expense converted to user's currency (multi-currency safe)
  const convertedMonthlyExpense = computed(() =>
    Object.entries(expenseByCurrency.value).reduce(
      (sum, [curr, amt]) => sum + convert(amt, curr),
      0,
    ),
  );

  // A) Average daily expense = convertedExpense / daysElapsed
  const avgDailyExpense = computed(() => {
    if (!showSpendingMetrics.value) return null;
    return convertedMonthlyExpense.value / daysElapsedInMonth.value;
  });

  // B) Safe daily balance = totalBalance (non-hidden accounts) / daysRemaining
  const safeDailyLimit = computed(() => {
    if (!showSpendingMetrics.value) return null;
    return totalBalance.value / daysRemainingInMonth.value;
  });

  return {
    userId,
    currency,
    userName,
    accounts,
    visibleAccounts,
    hiddenAccountCount,
    debts,
    reminders,
    expenseCategories,
    allCategories,
    recentTransactions,
    totalBalance,
    categoryBreakdown,
    accountsLoading,
    debtsLoading,
    remindersLoading,
    recentTxLoading,
    analyticsLoading,
    ratesLoading,
    widgetOrder,
    hiddenWidgets,
    budget,
    budgetLoading,
    budgetSaving,
    avgDailyExpense,
    safeDailyLimit,
    daysRemainingInMonth,
    setBudgetDefault: setDefault,
    setBudgetOverride: setOverride,
    removeBudgetOverride: removeOverride,
  };
}
