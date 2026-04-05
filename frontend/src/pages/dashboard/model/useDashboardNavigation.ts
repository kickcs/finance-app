import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import type { AccountWithBalances } from '@/entities/account';
import type { Debt } from '@/entities/debt';

export function useDashboardNavigation() {
  const router = useRouter();

  return {
    toProfile: () => router.push({ name: ROUTE_NAMES.PROFILE }),
    toAccount: (account: AccountWithBalances) =>
      router.push({ name: ROUTE_NAMES.ACCOUNT_DETAIL, params: { id: account.id } }),
    toNewAccount: () => router.push({ name: ROUTE_NAMES.NEW_ACCOUNT }),
    toAccounts: () => router.push({ name: ROUTE_NAMES.ACCOUNTS }),
    toNewTransaction: (type?: 'income' | 'expense') =>
      router.push(
        type
          ? { name: ROUTE_NAMES.NEW_TRANSACTION, query: { type } }
          : { name: ROUTE_NAMES.NEW_TRANSACTION },
      ),
    toHistory: () => router.push({ name: ROUTE_NAMES.HISTORY }),
    toDebt: (debt: Debt) => router.push({ name: ROUTE_NAMES.DEBT_DETAIL, params: { id: debt.id } }),
    toNewDebt: () => router.push({ name: ROUTE_NAMES.DEBTS_LIST }),
    toDebts: (person?: string, debtType?: 'given' | 'taken') =>
      person
        ? router.push({ name: ROUTE_NAMES.DEBTS_LIST, query: { person, type: debtType } })
        : router.push({ name: ROUTE_NAMES.DEBTS_LIST }),
    toAnalytics: (type: 'income' | 'expense') =>
      router.push({ name: ROUTE_NAMES.ANALYTICS, query: { type } }),
    toQuickActionsSettings: () => router.push({ name: ROUTE_NAMES.SETTINGS_QUICK_ACTIONS }),
    toDashboardSettings: () => router.push({ name: ROUTE_NAMES.DASHBOARD_SETTINGS }),
    toSubscriptions: () => router.push({ name: ROUTE_NAMES.SUBSCRIPTIONS_LIST }),
    toNewSubscription: () => router.push({ name: ROUTE_NAMES.NEW_SUBSCRIPTION }),
    toSubscription: (id: string) =>
      router.push({ name: ROUTE_NAMES.SUBSCRIPTION_DETAIL, params: { id } }),
  };
}
