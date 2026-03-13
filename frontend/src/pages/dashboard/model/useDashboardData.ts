import { computed } from 'vue';
import { useAccounts } from '@/entities/account';
import { useRecentTransactions, useAnalyticsStats } from '@/entities/transaction';
import { useDebts } from '@/entities/debt';
import { useReminders } from '@/entities/reminder';
import { useCategories } from '@/entities/category';
import { useBudget } from '@/entities/budget';
import { useProfile, useExchangeRates } from '@/shared/api';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { getGreeting } from '@/shared/lib/format/greeting';
import { toLocalISODate } from '@/shared/lib/date';
import type { WidgetId } from '@/shared/api/database.types';
import { DEFAULT_WIDGET_ORDER } from '@/shared/config/dashboard';

export function useDashboardData() {
  const { user, userId } = useCurrentUser();
  const { currency } = useUserCurrency();
  const { profile } = useProfile(userId);
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

  // Current month analytics (category breakdown for top expenses widget)
  const now = new Date();
  const monthStart = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = toLocalISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const { categoryBreakdown, isLoading: analyticsLoading } = useAnalyticsStats({
    startDate: monthStart,
    endDate: monthEnd,
  });

  // Greeting (static — doesn't need to be reactive)
  const greeting = getGreeting();

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

  return {
    userId,
    currency,
    greeting,
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
    setBudgetDefault: setDefault,
    setBudgetOverride: setOverride,
    removeBudgetOverride: removeOverride,
  };
}
