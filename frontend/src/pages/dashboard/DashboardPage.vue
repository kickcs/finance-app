<script setup lang="ts">
import { ref } from 'vue';
import { useLocalStorage } from '@/shared/lib/hooks/useLocalStorage';
import { queryClient } from '@/shared/api/queryClient';
import { PullToRefresh } from '@/shared/ui';
import { InstallPwaBanner, InstallPwaModal, usePwaInstall } from '@/features/install-pwa';
import { QuickActionModal } from '@/features/configure-quick-action';
import { AccountStack } from '@/widgets/account-stack';

import { useDashboardData } from './model/useDashboardData';
import { useDashboardQuickActions } from './model/useDashboardQuickActions';
import { useDashboardNavigation } from './model/useDashboardNavigation';
import { useStaggerAnimation } from './model/useStaggerAnimation';

import DashboardMobileHeader from './ui/DashboardMobileHeader.vue';
import DashboardHeroSection from './ui/DashboardHeroSection.vue';
import DashboardQuickActions from './ui/DashboardQuickActions.vue';
import DashboardActivityColumn from './ui/DashboardActivityColumn.vue';
import DashboardSidePanel from './ui/DashboardSidePanel.vue';

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

const nav = useDashboardNavigation();
const { staggerClass } = useStaggerAnimation();

const { showModal: showInstallModal } = usePwaInstall();
const isHidden = useLocalStorage('balance_hidden', false);
const quickActionsHintDismissed = useLocalStorage('quick_actions_hint_dismissed', false);

// Scroll tracking
const scrollContainerRef = ref<HTMLElement>();
const isScrolledPastBalance = ref(false);
const BALANCE_SCROLL_THRESHOLD = 80;

function onScroll(e: Event) {
  const scrollTop = (e.target as HTMLElement).scrollTop;
  const scrolled = scrollTop > BALANCE_SCROLL_THRESHOLD;
  if (scrolled !== isScrolledPastBalance.value) {
    isScrolledPastBalance.value = scrolled;
  }
}

async function handleRefresh() {
  await queryClient.invalidateQueries();
}
</script>

<template>
  <div class="h-full flex flex-col min-w-0 relative">
    <DashboardMobileHeader
      :user-name="userName"
      :greeting="greeting"
      :total-balance="totalBalance"
      :currency="currency"
      :is-hidden="isHidden"
      :is-scrolled-past-balance="isScrolledPastBalance"
      @profile-click="nav.toProfile"
    />

    <!-- Scrollable content -->
    <div ref="scrollContainerRef" class="flex-1 overflow-y-auto" @scroll="onScroll">
      <PullToRefresh :on-refresh="handleRefresh" :container-ref="scrollContainerRef">
        <main
          class="relative z-10 px-5 md:px-8 pt-6 md:pt-8 pb-28 md:pb-8 max-w-7xl mx-auto w-full"
        >
          <div class="mb-6 md:mb-8">
            <InstallPwaBanner @install="showInstallModal = true" />
          </div>

          <!-- Mobile layout (vertical stack) -->
          <div class="flex flex-col space-y-6 md:hidden">
            <section :class="staggerClass('delay-75')">
              <DashboardHeroSection
                :total-balance="totalBalance"
                :currency="currency"
                :percent-change="percentChange"
                :saved-this-month="savedThisMonth"
                :spent-this-month="spentThisMonth"
                :balance-loading="accountsLoading || statsLoading || ratesLoading"
                :stats-loading="statsLoading"
                :is-hidden="isHidden"
                @toggle-hidden="isHidden = !isHidden"
                @income-click="nav.toNewTransaction('income')"
                @expense-click="nav.toNewTransaction('expense')"
                @income-analytics="nav.toAnalytics('income')"
                @expense-analytics="nav.toAnalytics('expense')"
              />
            </section>

            <section :class="staggerClass('delay-150')">
              <DashboardQuickActions
                :slots="quickActionSlots"
                :category-map="categoryMap"
                :hint-dismissed="quickActionsHintDismissed"
                :hidden="quickActionsHidden"
                @click="handleQuickActionClick"
                @long-press="handleQuickActionLongPress"
                @dismiss-hint="quickActionsHintDismissed = true"
                @settings-click="nav.toQuickActionsSettings"
              />
            </section>

            <section :class="staggerClass('delay-200')">
              <AccountStack
                :accounts="accounts"
                :loading="accountsLoading"
                :hidden="isHidden"
                @account-click="nav.toAccount"
                @add-click="nav.toNewAccount"
                @view-all="nav.toAccounts"
              />
            </section>

            <section :class="staggerClass('delay-300')">
              <DashboardActivityColumn
                :transactions="recentTransactions"
                :debts="debts"
                :reminders="reminders"
                :user-id="userId"
                :currency="currency"
                :is-hidden="isHidden"
                :recent-tx-loading="recentTxLoading"
                :debts-loading="debtsLoading"
                :reminders-loading="remindersLoading"
                @transaction-click="nav.toHistory"
                @add-transaction="nav.toNewTransaction()"
                @view-all-transactions="nav.toHistory"
                @debt-click="nav.toDebt"
                @person-click="nav.toDebts"
                @add-debt="nav.toNewDebt"
                @view-all-debts="nav.toDebts"
                @reminder-click="nav.toReminder"
                @add-reminder="nav.toNewReminder"
                @view-all-reminders="nav.toReminders"
              />
            </section>
          </div>

          <!-- Desktop layout (8/4 fintech grid) -->
          <div class="hidden md:grid md:grid-cols-12 md:gap-6">
            <!-- Left Column: Hero + Transactions -->
            <div class="md:col-span-8 flex flex-col gap-6">
              <section :class="staggerClass('delay-75')">
                <DashboardHeroSection
                  :total-balance="totalBalance"
                  :currency="currency"
                  :percent-change="percentChange"
                  :saved-this-month="savedThisMonth"
                  :spent-this-month="spentThisMonth"
                  :balance-loading="accountsLoading || statsLoading || ratesLoading"
                  :stats-loading="statsLoading"
                  :is-hidden="isHidden"
                  @toggle-hidden="isHidden = !isHidden"
                  @income-click="nav.toNewTransaction('income')"
                  @expense-click="nav.toNewTransaction('expense')"
                  @income-analytics="nav.toAnalytics('income')"
                  @expense-analytics="nav.toAnalytics('expense')"
                />
              </section>

              <section :class="staggerClass('delay-150')">
                <DashboardActivityColumn
                  :transactions="recentTransactions"
                  :debts="debts"
                  :reminders="reminders"
                  :user-id="userId"
                  :currency="currency"
                  :is-hidden="isHidden"
                  :recent-tx-loading="recentTxLoading"
                  :debts-loading="debtsLoading"
                  :reminders-loading="remindersLoading"
                  class="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-6"
                  @transaction-click="nav.toHistory"
                  @add-transaction="nav.toNewTransaction()"
                  @view-all-transactions="nav.toHistory"
                  @debt-click="nav.toDebt"
                  @person-click="nav.toDebts"
                  @add-debt="nav.toNewDebt"
                  @view-all-debts="nav.toDebts"
                  @reminder-click="nav.toReminder"
                  @add-reminder="nav.toNewReminder"
                  @view-all-reminders="nav.toReminders"
                />
              </section>
            </div>

            <!-- Right Column: Quick Actions + Accounts + Debts + Reminders -->
            <div class="md:col-span-4">
              <section :class="staggerClass('delay-200')">
                <DashboardSidePanel
                  :quick-action-slots="quickActionSlots"
                  :category-map="categoryMap"
                  :hint-dismissed="quickActionsHintDismissed"
                  :quick-actions-hidden="quickActionsHidden"
                  :accounts="accounts"
                  :accounts-loading="accountsLoading"
                  :debts="debts"
                  :currency="currency"
                  :debts-loading="debtsLoading"
                  :reminders="reminders"
                  :reminders-loading="remindersLoading"
                  :is-hidden="isHidden"
                  @quick-action-click="handleQuickActionClick"
                  @quick-action-long-press="handleQuickActionLongPress"
                  @dismiss-hint="quickActionsHintDismissed = true"
                  @settings-click="nav.toQuickActionsSettings"
                  @account-click="nav.toAccount"
                  @add-account="nav.toNewAccount"
                  @view-all-accounts="nav.toAccounts"
                  @debt-click="nav.toDebt"
                  @person-click="nav.toDebts"
                  @add-debt="nav.toNewDebt"
                  @view-all-debts="nav.toDebts"
                  @reminder-click="nav.toReminder"
                  @add-reminder="nav.toNewReminder"
                  @view-all-reminders="nav.toReminders"
                />
              </section>
            </div>
          </div>
        </main>
      </PullToRefresh>
    </div>

    <InstallPwaModal v-model="showInstallModal" />

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
