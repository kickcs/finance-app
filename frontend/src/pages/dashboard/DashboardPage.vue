<script setup lang="ts">
import { computed, inject, ref, defineAsyncComponent } from 'vue';
import { useLocalStorage } from '@/shared/lib/hooks/useLocalStorage';
import type { Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';
import { useRouter } from 'vue-router';
import { queryClient } from '@/shared/api/queryClient';
import { PullToRefresh, UIcon } from '@/shared/ui';

// Critical components - load immediately
import { AppHeader } from '@/widgets/header';
import { BottomNav } from '@/widgets/bottom-nav';
import { ThemeToggle } from '@/features/toggle-theme';
import {
  InstallPwaBanner,
  InstallPwaModal,
  usePwaInstall,
} from '@/features/install-pwa';

// Above-the-fold widgets — eager load (no extra chunk downloads)
import BalanceCard from '@/widgets/balance-card/ui/BalanceCard.vue';
import SaveSpendSection from '@/widgets/save-spend-section/ui/SaveSpendSection.vue';
import AccountStack from '@/widgets/account-stack/ui/AccountStack.vue';

// Below-fold skeleton fallbacks
import { DebtsSectionSkeleton } from '@/widgets/debts-section';
import { RemindersSectionSkeleton } from '@/widgets/reminders-section';

// Below-fold widgets — lazy load
const DebtsSection = defineAsyncComponent({
  loader: () => import('@/widgets/debts-section/ui/DebtsSection.vue'),
  delay: 0,
});

const RemindersSection = defineAsyncComponent({
  loader: () => import('@/widgets/reminders-section/ui/RemindersSection.vue'),
  delay: 0,
});

// API composables
import { useAccounts, type AccountWithBalances } from '@/entities/account';
import { useMonthlyStats } from '@/entities/transaction';
import { useDebts, type Debt } from '@/entities/debt';
import { useReminders, type Reminder } from '@/entities/reminder';
import { useProfile, useExchangeRates } from '@/shared/api';

const router = useRouter();

// Get user from provide/inject
const user = inject<Ref<User | null>>('user');
const userId = computed(() => user?.value?.id ?? '');

// Get user currency from profile (fallback to localStorage for backward compatibility)
const { profile } = useProfile(userId);
const currency = computed(
  () =>
    profile.value?.currency ||
    localStorage.getItem('selectedCurrency') ||
    'UZS',
);

// Time-based greeting
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 17) return 'Добрый день';
  if (hour >= 17 && hour < 23) return 'Добрый вечер';
  return 'Доброй ночи';
});

const userName = computed(() => {
  const fullName = profile.value?.name || user?.value?.name;
  if (!fullName) return '';
  return fullName.split(' ')[0];
});

// Exchange rates for currency conversion
const { convert, isLoading: ratesLoading } = useExchangeRates(currency);

// Use real data from API (pass reactive userId, not .value)
const {
  accounts,
  totalBalancesByCurrency,
  isLoading: accountsLoading,
} = useAccounts(userId);
const { debts, isLoading: debtsLoading } = useDebts(userId);
const { reminders, isLoading: remindersLoading } = useReminders(userId);

// Monthly statistics from server (accurate, no limit issues)
const now = new Date();
const {
  incomeByCurrency,
  expenseByCurrency,
  isLoading: statsLoading,
} = useMonthlyStats(userId, {
  year: now.getFullYear(),
  month: now.getMonth() + 1,
});

// Last month stats for percent change calculation
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const {
  incomeByCurrency: lastMonthIncomeByCurrency,
  expenseByCurrency: lastMonthExpenseByCurrency,
} = useMonthlyStats(userId, {
  year: lastMonth.getFullYear(),
  month: lastMonth.getMonth() + 1,
});

// Total balance converted to user's main currency
const totalBalance = computed(() => {
  const balances = totalBalancesByCurrency.value;
  let total = 0;
  for (const [curr, amount] of Object.entries(balances)) {
    total += convert(amount, curr);
  }
  return total;
});

// Calculate saved/spent this month from server stats
// Convert each currency amount to user's main currency
const savedThisMonth = computed(() => {
  let total = 0;
  for (const [curr, amount] of Object.entries(incomeByCurrency.value)) {
    total += convert(amount, curr);
  }
  return total;
});

const spentThisMonth = computed(() => {
  let total = 0;
  for (const [curr, amount] of Object.entries(expenseByCurrency.value)) {
    total += convert(amount, curr);
  }
  return total;
});

// Calculate percent change compared to last month
// Compares savings rate (income - expenses) between months
const percentChange = computed(() => {
  // This month totals (converted to main currency)
  let thisMonthIncome = 0;
  for (const [curr, amount] of Object.entries(incomeByCurrency.value)) {
    thisMonthIncome += convert(amount, curr);
  }
  let thisMonthExpense = 0;
  for (const [curr, amount] of Object.entries(expenseByCurrency.value)) {
    thisMonthExpense += convert(amount, curr);
  }

  // Last month totals (converted to main currency)
  let lastMonthIncome = 0;
  for (const [curr, amount] of Object.entries(
    lastMonthIncomeByCurrency.value,
  )) {
    lastMonthIncome += convert(amount, curr);
  }
  let lastMonthExpense = 0;
  for (const [curr, amount] of Object.entries(
    lastMonthExpenseByCurrency.value,
  )) {
    lastMonthExpense += convert(amount, curr);
  }

  // If no data for last month, return undefined to hide the indicator
  if (lastMonthIncome === 0 && lastMonthExpense === 0) {
    return undefined;
  }

  // Calculate savings rates for both months
  const thisMonthSavings = thisMonthIncome - thisMonthExpense;
  const lastMonthSavings = lastMonthIncome - lastMonthExpense;

  // If no savings last month, show simple change indicator
  if (lastMonthSavings === 0) {
    return thisMonthSavings > 0 ? 100 : thisMonthSavings < 0 ? -100 : 0;
  }

  // Percentage change in savings
  return (
    ((thisMonthSavings - lastMonthSavings) / Math.abs(lastMonthSavings)) * 100
  );
});

function handleAccountClick(account: AccountWithBalances) {
  router.push(`/accounts/${account.id}`);
}

function handleAddAccount() {
  router.push('/accounts/new');
}

function handleViewAllAccounts() {
  router.push('/accounts');
}

function handleAddTransaction() {
  router.push('/transactions/new');
}

function handleIncomeClick() {
  router.push('/transactions/new?type=income');
}

function handleExpenseClick() {
  router.push('/transactions/new?type=expense');
}

const quickActions = [
  {
    label: 'Перевод',
    icon: 'swap_horiz',
    route: '/transactions/new?type=transfer',
    bgClass: 'bg-primary-light',
    iconClass: 'text-primary',
  },
  {
    label: 'Разделить',
    icon: 'call_split',
    route: '/transactions/new',
    bgClass: 'bg-success-light',
    iconClass: 'text-success',
  },
  {
    label: 'Курсы',
    icon: 'currency_exchange',
    route: '/settings/currency',
    bgClass: 'bg-warning-light',
    iconClass: 'text-warning',
  },
  {
    label: 'Категории',
    icon: 'category',
    route: '/settings/categories',
    bgClass: 'bg-info-light',
    iconClass: 'text-info',
  },
];

function handleAddReminder() {
  router.push({ name: 'new-reminder' });
}

function handleAddDebt() {
  router.push({ name: 'new-debt' });
}

function handleDebtClick(debt: Debt) {
  router.push({ name: 'debt-detail', params: { id: debt.id } });
}

function handlePersonClick(personName: string, debtType: 'given' | 'taken') {
  router.push({
    path: '/debts',
    query: { person: personName, type: debtType },
  });
}

function handleViewAllDebts() {
  router.push('/debts');
}

function handleReminderClick(reminder: Reminder) {
  router.push({ name: 'reminder-detail', params: { id: reminder.id } });
}

function handleViewAllReminders() {
  router.push('/reminders');
}

const { showModal: showInstallModal } = usePwaInstall();

const isHidden = useLocalStorage('balance_hidden', false);

const scrollContainerRef = ref<HTMLElement>();

async function handleRefresh() {
  await queryClient.invalidateQueries();
}
</script>

<template>
  <div
    class="h-dvh flex flex-col overflow-hidden bg-background-light dark:bg-background-dark"
  >
    <!-- Header -->
    <AppHeader>
      <template #logo>
        <div
          class="flex items-center gap-2.5 group cursor-pointer"
          @click="router.push('/profile')"
        >
          <div
            class="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-primary-hover shadow-lg shadow-primary/25 group-hover:shadow-xl group-hover:shadow-primary/30 group-hover:scale-105 transition-all duration-200"
          >
            <span class="text-white font-bold text-base">
              {{ userName ? userName[0].toUpperCase() : 'O' }}
            </span>
          </div>
          <div class="flex flex-col">
            <span
              class="text-xs text-text-secondary-light dark:text-text-secondary-dark leading-tight"
            >
              {{ greeting }}
            </span>
            <span
              class="font-bold text-base text-text-primary-light dark:text-text-primary-dark group-hover:text-primary transition-colors leading-tight"
            >
              {{ userName || 'Ouro' }}
            </span>
          </div>
        </div>
      </template>
      <template #actions>
        <ThemeToggle />
      </template>
    </AppHeader>

    <!-- Scrollable content -->
    <div ref="scrollContainerRef" class="flex-1 overflow-y-auto">
      <PullToRefresh
        :on-refresh="handleRefresh"
        :container-ref="scrollContainerRef"
      >
        <main class="relative z-10 px-5 pt-6 space-y-6 pb-28">
          <!-- PWA Install Banner -->
          <InstallPwaBanner @install="showInstallModal = true" />

          <!-- Hero Section — balance + stats -->
          <section class="space-y-6">
            <BalanceCard
              :total-balance="totalBalance"
              :currency="currency"
              :percent-change="percentChange"
              :loading="accountsLoading || statsLoading || ratesLoading"
              :hidden="isHidden"
              @toggle-hidden="isHidden = !isHidden"
              @income-click="handleIncomeClick"
              @expense-click="handleExpenseClick"
            />

            <SaveSpendSection
              :saved-amount="savedThisMonth"
              :spent-amount="spentThisMonth"
              :currency="currency"
              :loading="statsLoading"
              :hidden="isHidden"
              @income-click="router.push('/analytics?type=income')"
              @expense-click="router.push('/analytics?type=expense')"
            />
          </section>

          <!-- Quick Actions -->
          <section>
            <div class="grid grid-cols-4 gap-3">
              <button
                v-for="action in quickActions"
                :key="action.label"
                class="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-surface-light dark:bg-surface-dark hover:opacity-80 active:scale-95 transition-all duration-150"
                @click="router.push(action.route)"
              >
                <div
                  class="w-10 h-10 rounded-xl flex items-center justify-center"
                  :class="action.bgClass"
                >
                  <UIcon :name="action.icon" size="sm" :class="action.iconClass" />
                </div>
                <span class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                  {{ action.label }}
                </span>
              </button>
            </div>
          </section>

          <!-- Accounts -->
          <section>
            <AccountStack
              :accounts="accounts"
              :loading="accountsLoading"
              :hidden="isHidden"
              @account-click="handleAccountClick"
              @add-click="handleAddAccount"
              @view-all="handleViewAllAccounts"
            />
          </section>

          <!-- Debts -->
          <section>
            <Suspense>
              <DebtsSection
                :debts="debts"
                :currency="currency"
                :loading="debtsLoading"
                :hidden="isHidden"
                @debt-click="handleDebtClick"
                @person-click="handlePersonClick"
                @add-click="handleAddDebt"
                @view-all="handleViewAllDebts"
              />
              <template #fallback>
                <DebtsSectionSkeleton />
              </template>
            </Suspense>
          </section>

          <!-- Subscriptions -->
          <section>
            <Suspense>
              <RemindersSection
                :reminders="reminders"
                :currency="currency"
                :loading="remindersLoading"
                :hidden="isHidden"
                @reminder-click="handleReminderClick"
                @add-click="handleAddReminder"
                @view-all="handleViewAllReminders"
              />
              <template #fallback>
                <RemindersSectionSkeleton />
              </template>
            </Suspense>
          </section>
        </main>
      </PullToRefresh>
    </div>

    <!-- Bottom Navigation -->
    <BottomNav @add-click="handleAddTransaction" />

    <!-- PWA Install Modal -->
    <InstallPwaModal v-model="showInstallModal" />
  </div>
</template>
