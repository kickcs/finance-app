<script setup lang="ts">
import { ref, defineAsyncComponent, onMounted } from 'vue';
import { useLocalStorage } from '@/shared/lib/hooks/useLocalStorage';
import { useRouter } from 'vue-router';
import { queryClient } from '@/shared/api/queryClient';
import { PullToRefresh, UIcon } from '@/shared/ui';
import { formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import type { AccountWithBalances } from '@/entities/account';
import type { Transaction } from '@/entities/transaction';
import type { Debt } from '@/entities/debt';
import type { Reminder } from '@/entities/reminder';

// Components
import { AppHeader } from '@/widgets/header';
import { BottomNav } from '@/widgets/bottom-nav';
import { ThemeToggle } from '@/features/toggle-theme';
import {
  InstallPwaBanner,
  InstallPwaModal,
  usePwaInstall,
} from '@/features/install-pwa';
import { QuickActionModal } from '@/features/configure-quick-action';
import BalanceCard from '@/widgets/balance-card/ui/BalanceCard.vue';
import SaveSpendSection from '@/widgets/save-spend-section/ui/SaveSpendSection.vue';
import AccountStack from '@/widgets/account-stack/ui/AccountStack.vue';
import { DebtsSectionSkeleton } from '@/widgets/debts-section';
import { RemindersSectionSkeleton } from '@/widgets/reminders-section';
import { RecentTransactionsSkeleton } from '@/widgets/recent-transactions';

const DebtsSection = defineAsyncComponent({
  loader: () => import('@/widgets/debts-section/ui/DebtsSection.vue'),
  delay: 0,
});
const RemindersSection = defineAsyncComponent({
  loader: () => import('@/widgets/reminders-section/ui/RemindersSection.vue'),
  delay: 0,
});
const RecentTransactions = defineAsyncComponent({
  loader: () =>
    import('@/widgets/recent-transactions/ui/RecentTransactions.vue'),
  delay: 0,
});

// Composables
import { useDashboardData } from './model/useDashboardData';
import { useDashboardQuickActions } from './model/useDashboardQuickActions';

const router = useRouter();

const {
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
} = useDashboardData();

const {
  quickActionSlots,
  quickActionsHidden,
  showQuickActionModal,
  editingAction,
  categoryMap,
  handleClick: handleQuickActionClick,
  handleLongPress: handleQuickActionLongPress,
  handleSave: handleQuickActionSave,
  handleDelete: handleQuickActionDelete,
} = useDashboardQuickActions(allCategories);

// Navigation handlers
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
  router.push({ path: '/debts', query: { person: personName, type: debtType } });
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

// UI state
const { showModal: showInstallModal } = usePwaInstall();
const isHidden = useLocalStorage('balance_hidden', false);
const quickActionsHintDismissed = useLocalStorage(
  'quick_actions_hint_dismissed',
  false,
);

// Scroll tracking
const scrollContainerRef = ref<HTMLElement>();
const isScrolledPastBalance = ref(false);
const BALANCE_SCROLL_THRESHOLD = 80;

function onScroll(e: Event) {
  const target = e.target as HTMLElement;
  isScrolledPastBalance.value = target.scrollTop > BALANCE_SCROLL_THRESHOLD;
}

// Mount animation
const isMounted = ref(false);
onMounted(() => {
  requestAnimationFrame(() => {
    isMounted.value = true;
  });
});

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
          class="relative w-[200px] h-10 cursor-pointer overflow-hidden"
          @click="router.push('/profile')"
        >
          <!-- Default Greeting State -->
          <div
            class="absolute inset-0 flex items-center gap-2.5 group transition-all duration-300 ease-out"
            :class="
              isScrolledPastBalance
                ? '-translate-y-full opacity-0 pointer-events-none'
                : 'translate-y-0 opacity-100'
            "
          >
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-primary-hover shadow-sm shadow-primary/25 group-hover:shadow-md group-hover:shadow-primary/30 group-hover:scale-105 transition-all duration-200 shrink-0"
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
                class="font-bold text-base text-text-primary-light dark:text-text-primary-dark group-hover:text-primary transition-colors leading-tight truncate max-w-[140px]"
              >
                {{ userName || 'Ouro' }}
              </span>
            </div>
          </div>

          <!-- Sticky Balance State -->
          <div
            class="absolute inset-0 flex items-center gap-2.5 transition-all duration-300 ease-out"
            :class="
              isScrolledPastBalance
                ? 'translate-y-0 opacity-100'
                : 'translate-y-full opacity-0 pointer-events-none'
            "
          >
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shrink-0"
            >
              <UIcon
                name="account_balance_wallet"
                size="sm"
                class="text-primary"
              />
            </div>
            <div class="flex flex-col justify-center">
              <span
                class="text-caption-sm uppercase font-semibold tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark leading-none mb-1"
              >
                Общий баланс
              </span>
              <span
                class="font-bold text-sm text-text-primary-light dark:text-text-primary-dark leading-none tracking-tight"
              >
                {{
                  formatMasked(totalBalance, currency, isHidden, COMPACT_FORMAT)
                }}
              </span>
            </div>
          </div>
        </div>
      </template>
      <template #actions>
        <ThemeToggle />
      </template>
    </AppHeader>

    <!-- Scrollable content -->
    <div
      ref="scrollContainerRef"
      class="flex-1 overflow-y-auto"
      @scroll="onScroll"
    >
      <PullToRefresh
        :on-refresh="handleRefresh"
        :container-ref="scrollContainerRef"
      >
        <main class="relative z-10 px-5 pt-6 space-y-6 pb-28">
          <!-- PWA Install Banner -->
          <InstallPwaBanner @install="showInstallModal = true" />

          <!-- Hero Section — balance + stats -->
          <section
            class="space-y-6 transform transition-all duration-700 ease-out delay-75"
            :class="
              isMounted
                ? 'translate-y-0 opacity-100'
                : 'translate-y-8 opacity-0'
            "
          >
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
          <section
            v-if="!quickActionsHidden"
            class="transform transition-all duration-700 ease-out delay-150"
            :class="
              isMounted
                ? 'translate-y-0 opacity-100'
                : 'translate-y-8 opacity-0'
            "
          >
            <div class="grid grid-cols-4 gap-3">
              <button
                v-for="(action, index) in quickActionSlots"
                :key="action?.id ?? `empty-${index}`"
                class="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:bg-card-light dark:hover:bg-card-dark active:scale-95 active:translate-y-0 active:shadow-sm transition-all duration-200 group"
                @click="handleQuickActionClick(action)"
                @contextmenu.prevent="handleQuickActionLongPress(action)"
              >
                <template v-if="action">
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                    :style="{
                      backgroundColor:
                        (categoryMap.get(action.categoryId)?.color ??
                          '#64748b') + '1A',
                    }"
                  >
                    <UIcon
                      :name="
                        categoryMap.get(action.categoryId)?.icon ??
                        'receipt_long'
                      "
                      size="sm"
                      :style="{
                        color:
                          categoryMap.get(action.categoryId)?.color ??
                          '#64748b',
                      }"
                    />
                  </div>
                  <span
                    class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark truncate w-full text-center px-1"
                  >
                    {{ action.label }}
                  </span>
                </template>
                <template v-else>
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center bg-border-light/50 dark:bg-border-dark/50 group-hover:bg-border-light dark:group-hover:bg-border-dark transition-colors duration-200"
                  >
                    <UIcon
                      name="add"
                      size="sm"
                      class="text-text-tertiary-light dark:text-text-tertiary-dark"
                    />
                  </div>
                  <span
                    class="text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark"
                  >
                    Добавить
                  </span>
                </template>
              </button>
            </div>
            <!-- Hint — shown once until dismissed -->
            <div
              v-if="!quickActionsHintDismissed"
              class="mt-2 flex items-start gap-2 px-1"
            >
              <p
                class="text-caption-xs leading-snug text-text-tertiary-light dark:text-text-tertiary-dark"
              >
                Удерживайте кнопку для редактирования. Настроить или скрыть — в
                <button
                  class="underline text-primary"
                  @click="router.push('/settings/quick-actions')"
                >
                  Профиль → Быстрые действия</button
                >.
              </p>
              <button
                class="shrink-0 p-0.5 rounded text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark"
                @click="quickActionsHintDismissed = true"
              >
                <UIcon name="close" size="xs" />
              </button>
            </div>
          </section>

          <!-- Accounts -->
          <section
            class="transform transition-all duration-700 ease-out delay-200"
            :class="
              isMounted
                ? 'translate-y-0 opacity-100'
                : 'translate-y-8 opacity-0'
            "
          >
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
          <section
            class="transform transition-all duration-700 ease-out delay-300"
            :class="
              isMounted
                ? 'translate-y-0 opacity-100'
                : 'translate-y-8 opacity-0'
            "
          >
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
          <section
            class="transform transition-all duration-700 ease-out delay-500"
            :class="
              isMounted
                ? 'translate-y-0 opacity-100'
                : 'translate-y-8 opacity-0'
            "
          >
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
          <section
            class="transform transition-all duration-700 ease-out delay-[600ms]"
            :class="
              isMounted
                ? 'translate-y-0 opacity-100'
                : 'translate-y-8 opacity-0'
            "
          >
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
      :expense-categories="expenseCategories"
      :edit-action="editingAction"
      @save="handleQuickActionSave"
      @delete="handleQuickActionDelete"
    />
  </div>
</template>
