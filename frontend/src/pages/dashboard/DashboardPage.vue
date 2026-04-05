<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useLocalStorage, useEventListener, useTimeoutFn } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { ACTIVITY_WIDGET_IDS } from '@/shared/config/dashboard';
import { queryClient } from '@/shared/api/queryClient';
import {
  invalidateTransactionRelated,
  invalidateAccountRelated,
  invalidateSubscriptionRelated,
} from '@/shared/api/invalidation';
import { debtQueryKeys } from '@/entities/debt';
import { budgetQueryKeys } from '@/entities/budget';
import { PageContainer, PullToRefresh, UIcon, DiscoveryDot } from '@/shared/ui';
import { InstallPwaBanner, InstallPwaModal, usePwaInstall } from '@/features/install-pwa';
import { QuickActionModal } from '@/features/configure-quick-action';
import { AccountStack } from '@/widgets/account-stack';
import { BudgetSection } from '@/widgets/budget-section';
import { usePwaUpdateToast } from '@/shared/lib/composables/usePwaUpdate';
import { useFeatureHints, FeatureHintPopover } from '@/features/feature-hints';
import { SetBudgetSheet } from '@/features/set-budget';

import { useDashboardData } from './model/useDashboardData';
import { useDashboardQuickActions } from './model/useDashboardQuickActions';
import { useDashboardNavigation } from './model/useDashboardNavigation';
import { useStaggerAnimation } from './model/useStaggerAnimation';

import { getGreeting } from '@/shared/lib/format/greeting';
import { BalanceCard } from '@/widgets/balance-card';
import { PushNotificationBanner } from '@/widgets/push-notification-banner';

import { FinancialPeriodModal } from '@/features/configure-financial-period';

import DashboardMobileHeader from './ui/DashboardMobileHeader.vue';
import DashboardQuickActions from './ui/DashboardQuickActions.vue';
import DashboardActivityColumn from './ui/DashboardActivityColumn.vue';
import DashboardTopExpenses from './ui/DashboardTopExpenses.vue';
import DashboardSidePanel from './ui/DashboardSidePanel.vue';

const {
  isDotDismissed,
  dismissDot,
  incrementCounter,
  shouldShowHint,
  dismissHint,
  markHintShown,
  getHintConfig,
} = useFeatureHints();
const showSettingsDot = computed(() => !isDotDismissed('dashboard-settings'));

// Feature hints
const showSettingsHint = ref(false);
const settingsHintConfig = getHintConfig('dashboard-settings');

const { start: showSettingsHintDelayed } = useTimeoutFn(
  () => {
    showSettingsHint.value = true;
    markHintShown();
  },
  1000,
  { immediate: false },
);

onMounted(() => {
  incrementCounter('dashboard_visits');

  if (shouldShowHint('dashboard-settings')) {
    showSettingsHintDelayed();
  }
});

function dismissSettingsHint() {
  showSettingsHint.value = false;
  dismissHint('dashboard-settings');
}

function handleSettingsHintAction() {
  showSettingsHint.value = false;
  dismissHint('dashboard-settings');
  nav.toDashboardSettings();
}

const greeting = getGreeting();

const {
  userId,
  currency,
  userName,
  accounts,
  visibleAccounts,
  hiddenAccountCount,
  debts,
  expenseCategories,
  allCategories,
  recentTransactions,
  totalBalance,
  categoryBreakdown,
  accountsLoading,
  debtsLoading,
  recentTxLoading,
  analyticsLoading,
  ratesLoading,
  widgetOrder,
  hiddenWidgets,
  budget,
  budgetLoading,
  budgetSaving,
  setBudgetDefault,
  setBudgetOverride,
  removeBudgetOverride,
  avgDailyExpense,
  safeDailyLimit,
  daysRemainingInMonth,
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
const showBudgetSheet = ref(false);
onMounted(() => {
  usePwaUpdateToast();
});
const isHidden = useLocalStorage(STORAGE_KEYS.BALANCE_HIDDEN, false);
const showFinancialPeriodModal = ref(false);
const mobileTransactions = computed(() => recentTransactions.value.slice(0, 5));

// First visible activity widget ID - renders the single combined DashboardActivityColumn
const firstActivityWidgetId = computed(() =>
  widgetOrder.value.find((id) => ACTIVITY_WIDGET_IDS.has(id) && !hiddenWidgets.value.has(id)),
);

// Scroll tracking
const pageContainerRef = ref<InstanceType<typeof PageContainer>>();
const scrollContainerRef = computed(() => pageContainerRef.value?.scrollRef);
const isScrolledPastBalance = ref(false);
const BALANCE_SCROLL_THRESHOLD = 80;

useEventListener(scrollContainerRef, 'scroll', (e: Event) => {
  const scrollTop = (e.target as HTMLElement).scrollTop;
  const scrolled = scrollTop > BALANCE_SCROLL_THRESHOLD;
  if (scrolled !== isScrolledPastBalance.value) {
    isScrolledPastBalance.value = scrolled;
  }
});

async function handleRefresh() {
  const uid = userId.value;
  if (!uid) return;
  await Promise.all([
    invalidateTransactionRelated(queryClient, uid),
    invalidateAccountRelated(queryClient, uid),
    queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(uid) }),
    queryClient.invalidateQueries({ queryKey: budgetQueryKeys.all }),
    invalidateSubscriptionRelated(queryClient, uid),
  ]);
}

async function handleBudgetSave(amount: number) {
  if (budget.value?.budget?.isDefault === false) {
    const now = new Date();
    await setBudgetOverride(now.getFullYear(), now.getMonth() + 1, amount);
  } else {
    await setBudgetDefault(amount);
  }
  showBudgetSheet.value = false;
}

async function handleBudgetReset() {
  const now = new Date();
  await removeBudgetOverride(now.getFullYear(), now.getMonth() + 1);
  showBudgetSheet.value = false;
}

function handleSettingsClick() {
  dismissDot('dashboard-settings');
  nav.toDashboardSettings();
}
</script>

<template>
  <PageContainer ref="pageContainerRef" class="min-w-0 relative">
    <template #header>
      <DashboardMobileHeader
        :user-name="userName"
        :greeting="greeting"
        :total-balance="totalBalance"
        :currency="currency"
        :is-hidden="isHidden"
        :is-scrolled-past-balance="isScrolledPastBalance"
        :show-settings-dot="showSettingsDot"
        @profile-click="nav.toProfile"
        @settings-click="handleSettingsClick"
        @balance-click="nav.toAccounts"
      />
    </template>

    <main data-testid="dashboard-main" class="relative z-10 pt-3 md:pt-8 pb-28 md:pb-8">
      <div class="mb-6 md:mb-8">
        <InstallPwaBanner @install="showInstallModal = true" />
      </div>

      <!-- Mobile layout (vertical stack, with PullToRefresh) -->
      <PullToRefresh
        class="lg:hidden"
        :on-refresh="handleRefresh"
        :container-ref="scrollContainerRef"
      >
        <div data-testid="dashboard-mobile-layout" class="flex flex-col space-y-6 md:hidden">
          <section :class="staggerClass('delay-75')">
            <BalanceCard
              :total-balance="totalBalance"
              :currency="currency"
              :avg-daily-expense="avgDailyExpense"
              :safe-daily-limit="safeDailyLimit"
              :days-remaining="daysRemainingInMonth"
              :loading="accountsLoading || ratesLoading || analyticsLoading"
              :hidden="isHidden"
              @toggle-hidden="isHidden = !isHidden"
              @balance-click="nav.toAccounts"
            />
          </section>

          <section>
            <PushNotificationBanner :transaction-count="recentTransactions.length" />
          </section>

          <template v-for="widgetId in widgetOrder" :key="widgetId">
            <section
              v-if="widgetId === 'quick_actions' && !hiddenWidgets.has('quick_actions')"
              data-testid="widget-quick-actions"
              :class="staggerClass('delay-150')"
            >
              <DashboardQuickActions
                :slots="quickActionSlots"
                :category-map="categoryMap"
                :hint-dismissed="quickActionsHintDismissed"
                :hidden="quickActionsHidden"
                :loading="quickActionsLoading"
                @click="handleQuickActionClick"
                @long-press="handleQuickActionLongPress"
                @dismiss-hint="dismissQuickActionsHint"
                @settings-click="nav.toQuickActionsSettings"
              />
            </section>

            <section
              v-if="widgetId === 'accounts' && !hiddenWidgets.has('accounts')"
              data-testid="widget-accounts"
              :class="staggerClass('delay-300')"
            >
              <AccountStack
                :accounts="visibleAccounts"
                :loading="accountsLoading"
                :hidden="isHidden"
                :hidden-count="hiddenAccountCount"
                @account-click="nav.toAccount"
                @add-click="nav.toNewAccount"
                @view-all="nav.toAccounts"
              />
            </section>

            <section
              v-if="widgetId === 'top_expenses' && !hiddenWidgets.has('top_expenses')"
              data-testid="widget-top-expenses"
              :class="staggerClass('delay-300')"
            >
              <DashboardTopExpenses
                :category-breakdown="categoryBreakdown"
                :currency="currency"
                :loading="analyticsLoading"
                :is-hidden="isHidden"
                @configure-period="showFinancialPeriodModal = true"
              />
            </section>

            <!-- Single DashboardActivityColumn for transactions/debts on mobile -->
            <section
              v-if="widgetId === firstActivityWidgetId"
              data-testid="widget-activity"
              :class="staggerClass('delay-300')"
            >
              <DashboardActivityColumn
                :transactions="mobileTransactions"
                :debts="debts"
                :user-id="userId"
                :currency="currency"
                :is-hidden="isHidden"
                :recent-tx-loading="recentTxLoading"
                :debts-loading="debtsLoading"
                :widget-order="widgetOrder"
                :hidden-widgets="hiddenWidgets"
                @transaction-click="nav.toHistory"
                @add-transaction="nav.toNewTransaction()"
                @view-all-transactions="nav.toHistory"
                @debt-click="nav.toDebt"
                @person-click="nav.toDebts"
                @add-debt="nav.toNewDebt"
                @view-all-debts="nav.toDebts"
                @subscription-click="nav.toSubscription"
                @add-subscription="nav.toNewSubscription"
                @view-all-subscriptions="nav.toSubscriptions"
              />
            </section>

            <section
              v-if="widgetId === 'budget' && !hiddenWidgets.has('budget')"
              data-testid="widget-budget"
              :class="staggerClass('delay-150')"
            >
              <BudgetSection
                :budget="budget"
                :loading="budgetLoading"
                :hidden="isHidden"
                @setup="showBudgetSheet = true"
                @edit="showBudgetSheet = true"
              />
            </section>
          </template>

          <section class="flex justify-center mt-2 pb-4">
            <FeatureHintPopover
              v-if="settingsHintConfig"
              :config="settingsHintConfig"
              :open="showSettingsHint"
              side="top"
              @dismiss="dismissSettingsHint"
              @action="handleSettingsHintAction"
            >
              <div class="relative">
                <button
                  type="button"
                  data-testid="dashboard-settings-btn"
                  class="flex items-center gap-2 text-body-sm font-medium text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark transition-colors px-4 py-2 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark"
                  @click="handleSettingsClick"
                >
                  <UIcon name="tune" size="sm" />
                  Настроить вид дашборда
                </button>
                <DiscoveryDot :show="showSettingsDot" />
              </div>
            </FeatureHintPopover>
          </section>
        </div>
      </PullToRefresh>

      <!-- Desktop layout (8/4 fintech grid) -->
      <div class="hidden md:grid md:grid-cols-12 md:gap-6">
        <!-- Left Column: Hero + Transactions -->
        <div class="md:col-span-8 flex flex-col gap-6">
          <section :class="staggerClass('delay-75')">
            <BalanceCard
              :total-balance="totalBalance"
              :currency="currency"
              :avg-daily-expense="avgDailyExpense"
              :safe-daily-limit="safeDailyLimit"
              :days-remaining="daysRemainingInMonth"
              :loading="accountsLoading || ratesLoading || analyticsLoading"
              :hidden="isHidden"
              @toggle-hidden="isHidden = !isHidden"
              @balance-click="nav.toAccounts"
            />
          </section>

          <section>
            <PushNotificationBanner :transaction-count="recentTransactions.length" />
          </section>

          <section :class="staggerClass('delay-150')">
            <DashboardActivityColumn
              :transactions="recentTransactions"
              :debts="debts"
              :user-id="userId"
              :currency="currency"
              :is-hidden="isHidden"
              :recent-tx-loading="recentTxLoading"
              :debts-loading="debtsLoading"
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
              @subscription-click="nav.toSubscription"
              @add-subscription="nav.toNewSubscription"
              @view-all-subscriptions="nav.toSubscriptions"
            />
          </section>
        </div>

        <!-- Right Column: Quick Actions + Accounts + Debts -->
        <div class="md:col-span-4 self-start md:sticky md:top-0">
          <section :class="staggerClass('delay-200')">
            <DashboardSidePanel
              :quick-action-slots="quickActionSlots"
              :category-map="categoryMap"
              :hint-dismissed="quickActionsHintDismissed"
              :quick-actions-hidden="quickActionsHidden"
              :quick-actions-loading="quickActionsLoading"
              :accounts="visibleAccounts"
              :accounts-loading="accountsLoading"
              :hidden-account-count="hiddenAccountCount"
              :category-breakdown="categoryBreakdown"
              :analytics-loading="analyticsLoading"
              :debts="debts"
              :currency="currency"
              :debts-loading="debtsLoading"
              :user-id="userId"
              :budget="budget"
              :budget-loading="budgetLoading"
              :is-hidden="isHidden"
              :hidden-widgets="hiddenWidgets"
              :widget-order="widgetOrder"
              :show-settings-dot="showSettingsDot"
              @quick-action-click="handleQuickActionClick"
              @quick-action-long-press="handleQuickActionLongPress"
              @dismiss-hint="dismissQuickActionsHint"
              @settings-click="nav.toQuickActionsSettings"
              @account-click="nav.toAccount"
              @add-account="nav.toNewAccount"
              @view-all-accounts="nav.toAccounts"
              @debt-click="nav.toDebt"
              @person-click="nav.toDebts"
              @add-debt="nav.toNewDebt"
              @view-all-debts="nav.toDebts"
              @budget-setup="showBudgetSheet = true"
              @budget-edit="showBudgetSheet = true"
              @dashboard-settings-click="handleSettingsClick"
              @configure-period="showFinancialPeriodModal = true"
              @subscription-click="nav.toSubscription"
              @add-subscription="nav.toNewSubscription"
              @view-all-subscriptions="nav.toSubscriptions"
            />
          </section>
        </div>
      </div>
    </main>

    <InstallPwaModal v-model="showInstallModal" />

    <QuickActionModal
      v-model="showQuickActionModal"
      :accounts="accounts"
      :expense-categories="expenseCategories"
      :edit-action="editingAction"
      @save="handleQuickActionSave"
      @delete="handleQuickActionDelete"
    />

    <FinancialPeriodModal v-model="showFinancialPeriodModal" />

    <SetBudgetSheet
      v-model="showBudgetSheet"
      :current-amount="budget?.budget?.amount"
      :is-override="budget?.budget?.isDefault === false"
      :is-saving="budgetSaving"
      @save="handleBudgetSave"
      @reset="handleBudgetReset"
    />
  </PageContainer>
</template>
