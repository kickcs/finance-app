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
import type { WidgetId } from '@/shared/api/database.types';
import { DEFAULT_WIDGET_ORDER } from '@/shared/config/dashboard';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';

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
    totalExpense,
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

  const totalBalance = computed(() => {
    const filteredByCurrency: Record<string, number> = {};
    for (const account of accounts.value) {
      if (hiddenAccountIds.value.has(account.id)) continue;
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

  const daysElapsedInMonth = computed(() => currentDate.value.getDate());

  const daysRemainingInMonth = computed(() => {
    const d = currentDate.value;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return Math.max(1, lastDay - d.getDate() + 1);
  });

  // Show spending metrics only after the first week of the month (7+ days of data)
  const showSpendingMetrics = computed(() => daysElapsedInMonth.value >= 7);

  // A) Average daily expense = totalExpense / daysElapsed
  const avgDailyExpense = computed(() => {
    if (!showSpendingMetrics.value) return null;
    return totalExpense.value / daysElapsedInMonth.value;
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
