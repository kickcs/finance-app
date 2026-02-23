import { useRouter } from 'vue-router';
import type { AccountWithBalances } from '@/entities/account';
import type { Debt } from '@/entities/debt';
import type { Reminder } from '@/entities/reminder';

export function useDashboardNavigation() {
  const router = useRouter();

  return {
    toProfile: () => router.push('/profile'),
    toAccount: (account: AccountWithBalances) => router.push(`/accounts/${account.id}`),
    toNewAccount: () => router.push('/accounts/new'),
    toAccounts: () => router.push('/accounts'),
    toNewTransaction: (type?: 'income' | 'expense') =>
      router.push(type ? `/transactions/new?type=${type}` : '/transactions/new'),
    toHistory: () => router.push('/history'),
    toDebt: (debt: Debt) => router.push({ name: 'debt-detail', params: { id: debt.id } }),
    toNewDebt: () => router.push({ name: 'new-debt' }),
    toDebts: (person?: string, debtType?: 'given' | 'taken') =>
      person
        ? router.push({ path: '/debts', query: { person, type: debtType } })
        : router.push('/debts'),
    toReminder: (reminder: Reminder) =>
      router.push({ name: 'reminder-detail', params: { id: reminder.id } }),
    toNewReminder: () => router.push({ name: 'new-reminder' }),
    toReminders: () => router.push('/reminders'),
    toAnalytics: (type: 'income' | 'expense') => router.push(`/analytics?type=${type}`),
    toQuickActionsSettings: () => router.push('/settings/quick-actions'),
    toScanReceipt: () => router.push('/scan-receipt'),
  };
}
