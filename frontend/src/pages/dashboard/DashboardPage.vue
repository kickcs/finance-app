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
import {
  QuickActionModal,
  useQuickActions,
  type QuickAction,
} from '@/features/configure-quick-action';

// Above-the-fold widgets — eager load (no extra chunk downloads)
import BalanceCard from '@/widgets/balance-card/ui/BalanceCard.vue';
import SaveSpendSection from '@/widgets/save-spend-section/ui/SaveSpendSection.vue';
import AccountStack from '@/widgets/account-stack/ui/AccountStack.vue';

// Below-fold skeleton fallbacks
import { DebtsSectionSkeleton } from '@/widgets/debts-section';
import { RemindersSectionSkeleton } from '@/widgets/reminders-section';
import { RecentTransactionsSkeleton } from '@/widgets/recent-transactions';

// Below-fold widgets — lazy load
const DebtsSection = defineAsyncComponent({
  loader: () => import('@/widgets/debts-section/ui/DebtsSection.vue'),
  delay: 0,
});

const RemindersSection = defineAsyncComponent({
  loader: () => import('@/widgets/reminders-section/ui/RemindersSection.vue'),
  delay: 0,
});

const RecentTransactions = defineAsyncComponent({
  loader: () => import('@/widgets/recent-transactions/ui/RecentTransactions.vue'),
  delay: 0,
});

// API composables
import { useAccounts, type AccountWithBalances } from '@/entities/account';
import { useMonthlyStats, useRecentTransactions } from '@/entities/transaction';
import type { Transaction } from '@/entities/transaction';
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
const { transactions: recentTransactions, isLoading: recentTxLoading } =
  useRecentTransactions(userId, 5);

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

const { slots: quickActionSlots, addAction, updateAction, removeAction, getCategory } =
  useQuickActions();

const showQuickActionModal = ref(false);
const editingAction = ref<QuickAction | null>(null);

function handleQuickActionClick(action: QuickAction | null) {
  if (!action) {
    editingAction.value = null;
    showQuickActionModal.value = true;
    return;
  }
  router.push(
    `/transactions/new?type=expense&categoryId=${action.categoryId}&accountId=${action.accountId}`,
  );
}

function handleQuickActionLongPress(action: QuickAction | null) {
  if (!action) {
    editingAction.value = null;
    showQuickActionModal.value = true;
    return;
  }
  editingAction.value = action;
  showQuickActionModal.value = true;
}

function handleQuickActionSave(data: { label: string; categoryId: string; accountId: string }) {
  if (editingAction.value) {
    updateAction(editingAction.value.id, data);
  } else {
    addAction(data);
  }
  editingAction.value = null;
}

function handleQuickActionDelete() {
  if (editingAction.value) {
    removeAction(editingAction.value.id);
  }
  editingAction.value = null;
}

function handleTransactionClick(_tx: Transaction) {
  router.push('/history');
}

function handleViewAllTransactions() {
  router.push('/history');
}

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
                v-for="(action, index) in quickActionSlots"
                :key="action?.id ?? `empty-${index}`"
                class="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-surface-light dark:bg-surface-dark hover:opacity-80 active:scale-95 transition-all duration-150"
                @click="handleQuickActionClick(action)"
                @contextmenu.prevent="handleQuickActionLongPress(action)"
              >
                <template v-if="action">
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center"
                    :style="{ backgroundColor: (getCategory(action.categoryId)?.color ?? '#64748b') + '1A' }"
                  >
                    <UIcon
                      :name="getCategory(action.categoryId)?.icon ?? 'receipt_long'"
                      size="sm"
                      :style="{ color: getCategory(action.categoryId)?.color ?? '#64748b' }"
                    />
                  </div>
                  <span class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark truncate w-full text-center px-1">
                    {{ action.label }}
                  </span>
                </template>
                <template v-else>
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-border-light dark:bg-border-dark">
                    <UIcon name="add" size="sm" class="text-text-tertiary-light dark:text-text-tertiary-dark" />
                  </div>
                  <span class="text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark">
                    Добавить
                  </span>
                </template>
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

          <!-- Recent Transactions -->
          <section>
            <Suspense>
              <RecentTransactions
                :transactions="recentTransactions"
                :user-id="userId"
                :loading="recentTxLoading"
                :hidden="isHidden"
                @transaction-click="handleTransactionClick"
                @add-click="handleAddTransaction"
                @view-all="handleViewAllTransactions"
              />
              <template #fallback>
                <RecentTransactionsSkeleton />
              </template>
            </Suspense>
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

    <!-- Quick Action Configure Modal -->
    <QuickActionModal
      v-model="showQuickActionModal"
      :accounts="accounts"
      :edit-action="editingAction"
      @save="handleQuickActionSave"
      @delete="handleQuickActionDelete"
    />
  </div>
</template>
