<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useLocalStorage, useEventListener, useTimeoutFn } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { queryClient } from '@/shared/api/queryClient';
import {
  invalidateTransactionRelated,
  invalidateAccountRelated,
  invalidateSubscriptionRelated,
} from '@/shared/api/invalidation';
import { debtQueryKeys } from '@/entities/debt';
import { budgetQueryKeys } from '@/entities/budget';
import { PageContainer } from '@/shared/ui';
import { InstallPwaBanner, InstallPwaModal, usePwaInstall } from '@/features/install-pwa';
import { QuickActionModal } from '@/features/configure-quick-action';
import { usePwaUpdateToast } from '@/shared/lib/composables/usePwaUpdate';
import { useFeatureHints } from '@/features/feature-hints';
import { SetBudgetSheet } from '@/features/set-budget';

import { useDashboardData } from './model/useDashboardData';
import { useDashboardQuickActions } from './model/useDashboardQuickActions';
import { useDashboardNavigation } from './model/useDashboardNavigation';
import { provideDashboardContext } from './model/dashboardContext';

import { getGreeting } from '@/shared/lib/format/greeting';
import { FinancialPeriodModal } from '@/features/configure-financial-period';

import DashboardMobileHeader from './ui/DashboardMobileHeader.vue';
import DashboardCompactView from './ui/DashboardCompactView.vue';
import DashboardStandardLayout from './ui/DashboardStandardLayout.vue';
import { useHaptics } from '@/shared/lib/haptics';

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

const greeting = getGreeting();

const data = useDashboardData();
const { userName, totalBalance, currency, accounts, expenseCategories, budget, budgetSaving } =
  data;

const quickActions = useDashboardQuickActions(data.allCategories, data.userId);
const { showQuickActionModal, editingAction } = quickActions;

const nav = useDashboardNavigation();

const { showModal: showInstallModal } = usePwaInstall();
const showBudgetSheet = ref(false);
const showFinancialPeriodModal = ref(false);
usePwaUpdateToast();

const isHidden = useLocalStorage(STORAGE_KEYS.BALANCE_HIDDEN, false);
const isCompactMode = useLocalStorage(STORAGE_KEYS.DASHBOARD_COMPACT_MODE, false);
const { trigger: triggerHaptic } = useHaptics();

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

function toggleCompactMode() {
  triggerHaptic('selection');
  isCompactMode.value = !isCompactMode.value;
  const scrollEl = scrollContainerRef.value;
  if (scrollEl instanceof HTMLElement) {
    scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

async function handleRefresh() {
  const uid = data.userId.value;
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
    await data.setBudgetOverride(now.getFullYear(), now.getMonth() + 1, amount);
  } else {
    await data.setBudgetDefault(amount);
  }
  showBudgetSheet.value = false;
}

async function handleBudgetReset() {
  const now = new Date();
  await data.removeBudgetOverride(now.getFullYear(), now.getMonth() + 1);
  showBudgetSheet.value = false;
}

function handleSettingsClick() {
  dismissDot('dashboard-settings');
  nav.toDashboardSettings();
}

function dismissSettingsHint() {
  showSettingsHint.value = false;
  dismissHint('dashboard-settings');
}

function handleSettingsHintAction() {
  showSettingsHint.value = false;
  dismissHint('dashboard-settings');
  nav.toDashboardSettings();
}

provideDashboardContext({
  totalBalance: data.totalBalance,
  currency: data.currency,
  avgDailyExpense: data.avgDailyExpense,
  safeDailyLimit: data.safeDailyLimit,
  daysRemainingInMonth: data.daysRemainingInMonth,
  visibleAccounts: data.visibleAccounts,
  hiddenAccountCount: data.hiddenAccountCount,
  recentTransactions: data.recentTransactions,
  categoryBreakdown: data.categoryBreakdown,
  debts: data.debts,
  budget: data.budget,
  upcomingSubscriptions: data.upcomingSubscriptions,
  getCategoryById: data.getCategoryById,
  quickActionSlots: quickActions.quickActionSlots,
  quickActionsHidden: quickActions.quickActionsHidden,
  quickActionsHintDismissed: quickActions.quickActionsHintDismissed,
  categoryMap: quickActions.categoryMap,
  userId: data.userId,
  isHidden,
  isCompactMode,
  convert: data.convert,
  widgetOrder: data.widgetOrder,
  hiddenWidgets: data.hiddenWidgets,
  accountsLoading: data.accountsLoading,
  ratesLoading: data.ratesLoading,
  analyticsLoading: data.analyticsLoading,
  recentTxLoading: data.recentTxLoading,
  debtsLoading: data.debtsLoading,
  budgetLoading: data.budgetLoading,
  quickActionsLoading: quickActions.quickActionsLoading,
  subscriptionsLoading: data.subscriptionsLoading,
  balanceLoading: data.balanceLoading,
  showSettingsDot,
  showSettingsHint,
  settingsHintConfig,
  scrollContainerRef,
  onRefresh: handleRefresh,
  nav,
  toggleHidden: () => {
    isHidden.value = !isHidden.value;
  },
  toggleCompactMode,
  openBudgetSheet: () => {
    showBudgetSheet.value = true;
  },
  openFinancialPeriodModal: () => {
    showFinancialPeriodModal.value = true;
  },
  openDashboardSettings: handleSettingsClick,
  dismissSettingsHint,
  handleSettingsHintAction,
  handleQuickActionClick: quickActions.handleClick,
  handleQuickActionLongPress: quickActions.handleLongPress,
  dismissQuickActionsHint: quickActions.dismissHint,
});
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

      <DashboardCompactView v-if="isCompactMode" />
      <DashboardStandardLayout v-else />
    </main>

    <InstallPwaModal v-model="showInstallModal" />

    <QuickActionModal
      v-model="showQuickActionModal"
      :accounts="accounts"
      :expense-categories="expenseCategories"
      :edit-action="editingAction"
      @save="quickActions.handleSave"
      @delete="quickActions.handleDelete"
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
