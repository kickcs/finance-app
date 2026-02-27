import { computed } from 'vue';
import { useAccounts } from '@/entities/account';
import { useMonthlyStats, useRecentTransactions } from '@/entities/transaction';
import { useDebts } from '@/entities/debt';
import { useReminders } from '@/entities/reminder';
import { useCategories } from '@/entities/category';
import { useProfile, useExchangeRates } from '@/shared/api';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { getGreeting } from '@/shared/lib/format/greeting';
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
  const { expenseCategories, allCategories } = useCategories(userId);
  const { transactions: recentTransactions, isLoading: recentTxLoading } = useRecentTransactions(
    userId,
    10,
  );

  // Monthly statistics
  const now = new Date();
  const {
    incomeByCurrency,
    expenseByCurrency,
    isLoading: statsLoading,
  } = useMonthlyStats(userId, {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  // Last month stats for percent change
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const {
    incomeByCurrency: lastMonthIncomeByCurrency,
    expenseByCurrency: lastMonthExpenseByCurrency,
  } = useMonthlyStats(userId, {
    year: lastMonth.getFullYear(),
    month: lastMonth.getMonth() + 1,
  });

  // Greeting (static — doesn't need to be reactive)
  const greeting = getGreeting();

  const userName = computed(() => {
    const fullName = profile.value?.name || user?.value?.name;
    if (!fullName) return '';
    return fullName.split(' ')[0];
  });

  // Helper to sum currency map with conversion
  function sumConverted(byCurrency: Record<string, number>): number {
    let total = 0;
    for (const [curr, amount] of Object.entries(byCurrency)) {
      total += convert(amount, curr);
    }
    return total;
  }

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
    return sumConverted(filteredByCurrency);
  });

  const savedThisMonth = computed(() => sumConverted(incomeByCurrency.value));

  const spentThisMonth = computed(() => sumConverted(expenseByCurrency.value));

  const percentChange = computed(() => {
    const lastIncome = sumConverted(lastMonthIncomeByCurrency.value);
    const lastExpense = sumConverted(lastMonthExpenseByCurrency.value);

    if (lastIncome === 0 && lastExpense === 0) return undefined;

    const thisSavings = savedThisMonth.value - spentThisMonth.value;
    const lastSavings = lastIncome - lastExpense;

    if (lastSavings === 0) {
      return thisSavings > 0 ? 100 : thisSavings < 0 ? -100 : 0;
    }

    return ((thisSavings - lastSavings) / Math.abs(lastSavings)) * 100;
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
    savedThisMonth,
    spentThisMonth,
    percentChange,
    accountsLoading,
    debtsLoading,
    remindersLoading,
    recentTxLoading,
    statsLoading,
    ratesLoading,
    widgetOrder,
    hiddenWidgets,
  };
}
