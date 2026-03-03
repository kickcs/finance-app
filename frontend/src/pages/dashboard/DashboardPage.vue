<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { debtQueryKeys } from '@/entities/debt';
import { reminderQueryKeys } from '@/entities/reminder';
import { PullToRefresh, UIcon } from '@/shared/ui';
import { InstallPwaBanner, InstallPwaModal, usePwaInstall } from '@/features/install-pwa';
import { QuickActionModal } from '@/features/configure-quick-action';
import { AccountStack } from '@/widgets/account-stack';
import { useHaptics } from '@/shared/lib/haptics';
import { usePwaUpdateToast } from '@/shared/lib/composables/usePwaUpdate';

import { useDashboardData } from './model/useDashboardData';
import { useDashboardQuickActions } from './model/useDashboardQuickActions';
import { useDashboardNavigation } from './model/useDashboardNavigation';
import { useStaggerAnimation } from './model/useStaggerAnimation';

import DashboardMobileHeader from './ui/DashboardMobileHeader.vue';
import DashboardHeroSection from './ui/DashboardHeroSection.vue';
import DashboardQuickActions from './ui/DashboardQuickActions.vue';
import DashboardActivityColumn from './ui/DashboardActivityColumn.vue';
import DashboardTopExpenses from './ui/DashboardTopExpenses.vue';
import DashboardSidePanel from './ui/DashboardSidePanel.vue';

const { trigger } = useHaptics();

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
  categoryBreakdown,
  accountsLoading,
  debtsLoading,
  remindersLoading,
  recentTxLoading,
  analyticsLoading,
  ratesLoading,
  widgetOrder,
  hiddenWidgets,
} = useDashboardData();

const {
  quickActionSlots,
  quickActionsHidden,
  quickActionsHintDismissed,
  quickActionsLoading,
  dismissHint: dismissQuickActionsHint,
  showQuickActionModal,
  editingAction,
  categoryMap,
  handleClick: handleQuickActionClick,
  handleLongPress: handleQuickActionLongPress,
  handleSave: handleQuickActionSave,
  handleDelete: handleQuickActionDelete,
} = useDashboardQuickActions(allCategories, userId);

const nav = useDashboardNavigation();
const { staggerClass } = useStaggerAnimation();

const { showModal: showInstallModal } = usePwaInstall();
onMounted(() => usePwaUpdateToast());
const isHidden = useLocalStorage(STORAGE_KEYS.BALANCE_HIDDEN, false);
const mobileTransactions = computed(() => recentTransactions.value.slice(0, 5));

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
  const uid = userId.value;
  if (!uid) return;
  await Promise.all([
    invalidateTransactionRelated(queryClient, uid),
    invalidateAccountRelated(queryClient, uid),
    queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(uid) }),
    queryClient.invalidateQueries({ queryKey: reminderQueryKeys.list(uid) }),
  ]);
}

function handleScanReceipt() {
  trigger('selection');
  // TODO: re-enable after beta — premium gate for scan receipt
  nav.toScanReceipt();
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
      @settings-click="nav.toDashboardSettings"
      @balance-click="nav.toAccounts"
    />

    <!-- Scrollable content -->
    <div ref="scrollContainerRef" class="flex-1 overflow-y-auto" @scroll="onScroll">
      <PullToRefresh :on-refresh="handleRefresh" :container-ref="scrollContainerRef">
        <main
          class="relative z-10 px-5 md:px-8 pt-3 md:pt-8 pb-28 md:pb-8 max-w-7xl mx-auto w-full"
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
                :balance-loading="accountsLoading || ratesLoading"
                :is-hidden="isHidden"
                @toggle-hidden="isHidden = !isHidden"
                @balance-click="nav.toAccounts"
              />
            </section>

            <template v-for="widgetId in widgetOrder" :key="widgetId">
              <section
                v-if="widgetId === 'quick_actions' && !hiddenWidgets.has('quick_actions')"
                :class="staggerClass('delay-150')"
              >
                <DashboardQuickActions
                  :slots="quickActionSlots"
                  :category-map="categoryMap"
                  :hint-dismissed="quickActionsHintDismissed"
                  :hidden="quickActionsHidden"
                  :loading="quickActionsLoading"
                  show-scan-button
                  @click="handleQuickActionClick"
                  @long-press="handleQuickActionLongPress"
                  @dismiss-hint="dismissQuickActionsHint"
                  @settings-click="nav.toQuickActionsSettings"
                  @scan-click="handleScanReceipt"
                />
              </section>

              <section
                v-if="widgetId === 'accounts' && !hiddenWidgets.has('accounts')"
                :class="staggerClass('delay-300')"
              >
                <AccountStack
                  :accounts="accounts"
                  :loading="accountsLoading"
                  :hidden="isHidden"
                  @account-click="nav.toAccount"
                  @add-click="nav.toNewAccount"
                  @view-all="nav.toAccounts"
                />
              </section>

              <section
                v-if="widgetId === 'top_expenses' && !hiddenWidgets.has('top_expenses')"
                :class="staggerClass('delay-300')"
              >
                <DashboardTopExpenses
                  :category-breakdown="categoryBreakdown"
                  :currency="currency"
                  :loading="analyticsLoading"
                  :is-hidden="isHidden"
                />
              </section>

              <section
                v-if="widgetId === 'transactions' && !hiddenWidgets.has('transactions')"
                :class="staggerClass('delay-300')"
              >
                <DashboardActivityColumn
                  :transactions="mobileTransactions"
                  :debts="[]"
                  :reminders="[]"
                  :user-id="userId"
                  :currency="currency"
                  :is-hidden="isHidden"
                  :recent-tx-loading="recentTxLoading"
                  :debts-loading="false"
                  :reminders-loading="false"
                  :widget-order="['transactions']"
                  @transaction-click="nav.toHistory"
                  @add-transaction="nav.toNewTransaction()"
                  @view-all-transactions="nav.toHistory"
                />
              </section>

              <section
                v-if="widgetId === 'debts' && !hiddenWidgets.has('debts')"
                :class="staggerClass('delay-300')"
              >
                <DashboardActivityColumn
                  :transactions="[]"
                  :debts="debts"
                  :reminders="[]"
                  :user-id="userId"
                  :currency="currency"
                  :is-hidden="isHidden"
                  :recent-tx-loading="false"
                  :debts-loading="debtsLoading"
                  :reminders-loading="false"
                  :widget-order="['debts']"
                  @debt-click="nav.toDebt"
                  @person-click="nav.toDebts"
                  @add-debt="nav.toNewDebt"
                  @view-all-debts="nav.toDebts"
                />
              </section>

              <section
                v-if="widgetId === 'reminders' && !hiddenWidgets.has('reminders')"
                :class="staggerClass('delay-300')"
              >
                <DashboardActivityColumn
                  :transactions="[]"
                  :debts="[]"
                  :reminders="reminders"
                  :user-id="userId"
                  :currency="currency"
                  :is-hidden="isHidden"
                  :recent-tx-loading="false"
                  :debts-loading="false"
                  :reminders-loading="remindersLoading"
                  :widget-order="['reminders']"
                  @reminder-click="nav.toReminder"
                  @add-reminder="nav.toNewReminder"
                  @view-all-reminders="nav.toReminders"
                />
              </section>
            </template>

            <section class="flex justify-center mt-2 pb-4">
              <button
                type="button"
                class="flex items-center gap-2 text-[13px] font-medium text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark transition-colors px-4 py-2 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark"
                @click="nav.toDashboardSettings"
              >
                <UIcon name="tune" size="sm" />
                Настроить вид дашборда
              </button>
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
                  :balance-loading="accountsLoading || ratesLoading"
                  :is-hidden="isHidden"
                  @toggle-hidden="isHidden = !isHidden"
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
                  :hidden-widgets="hiddenWidgets"
                  :widget-order="widgetOrder"
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
            <div class="md:col-span-4 self-start md:sticky md:top-0">
              <section :class="staggerClass('delay-200')">
                <DashboardSidePanel
                  :quick-action-slots="quickActionSlots"
                  :category-map="categoryMap"
                  :hint-dismissed="quickActionsHintDismissed"
                  :quick-actions-hidden="quickActionsHidden"
                  :quick-actions-loading="quickActionsLoading"
                  :accounts="accounts"
                  :accounts-loading="accountsLoading"
                  :category-breakdown="categoryBreakdown"
                  :analytics-loading="analyticsLoading"
                  :debts="debts"
                  :currency="currency"
                  :debts-loading="debtsLoading"
                  :reminders="reminders"
                  :reminders-loading="remindersLoading"
                  :is-hidden="isHidden"
                  :hidden-widgets="hiddenWidgets"
                  :widget-order="widgetOrder"
                  @quick-action-click="handleQuickActionClick"
                  @quick-action-long-press="handleQuickActionLongPress"
                  @dismiss-hint="dismissQuickActionsHint"
                  @settings-click="nav.toQuickActionsSettings"
                  @scan-click="handleScanReceipt"
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
                  @dashboard-settings-click="nav.toDashboardSettings"
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
