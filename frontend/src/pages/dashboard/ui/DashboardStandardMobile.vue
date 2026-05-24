<script setup lang="ts">
import { computed } from 'vue';
import { PullToRefresh, UIcon, DiscoveryDot } from '@/shared/ui';
import { ACTIVITY_WIDGET_IDS } from '@/shared/config/dashboard';
import { BalanceCard } from '@/widgets/balance-card';
import { PushNotificationBanner } from '@/widgets/push-notification-banner';
import { AccountStack } from '@/widgets/account-stack';
import { BudgetSection } from '@/widgets/budget-section';
import { FeatureHintPopover } from '@/features/feature-hints';
import DashboardQuickActions from './DashboardQuickActions.vue';
import DashboardActivityColumn from './DashboardActivityColumn.vue';
import DashboardTopExpenses from './DashboardTopExpenses.vue';
import { useDashboardContext } from '../model/dashboardContext';
import { useStaggerAnimation } from '../model/useStaggerAnimation';

const MOBILE_TX_LIMIT = 5;

const {
  totalBalance,
  currency,
  convert,
  avgDailyExpense,
  safeDailyLimit,
  daysRemainingInMonth,
  visibleAccounts,
  hiddenAccountCount,
  recentTransactions,
  categoryBreakdown,
  budget,
  isHidden,
  widgetOrder,
  hiddenWidgets,
  accountsLoading,
  analyticsLoading,
  budgetLoading,
  balanceLoading,
  showSettingsDot,
  showSettingsHint,
  settingsHintConfig,
  scrollContainerRef,
  onRefresh,
  nav,
  toggleHidden,
  openBudgetSheet,
  openFinancialPeriodModal,
  openDashboardSettings,
  dismissSettingsHint,
  handleSettingsHintAction,
} = useDashboardContext();

const { staggerClass } = useStaggerAnimation();

const firstActivityWidgetId = computed(() =>
  widgetOrder.value.find((id) => ACTIVITY_WIDGET_IDS.has(id) && !hiddenWidgets.value.has(id)),
);
</script>

<template>
  <PullToRefresh :on-refresh="onRefresh" :container-ref="scrollContainerRef">
    <div data-testid="dashboard-mobile-layout" class="flex flex-col space-y-6">
      <section :class="staggerClass('delay-75')">
        <BalanceCard
          :total-balance="totalBalance"
          :currency="currency"
          :avg-daily-expense="avgDailyExpense"
          :safe-daily-limit="safeDailyLimit"
          :days-remaining="daysRemainingInMonth"
          :loading="balanceLoading"
          :hidden="isHidden"
          @toggle-hidden="toggleHidden"
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
          <DashboardQuickActions />
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
            :convert="convert"
            :loading="analyticsLoading"
            :is-hidden="isHidden"
            @configure-period="openFinancialPeriodModal"
          />
        </section>

        <section
          v-if="widgetId === firstActivityWidgetId"
          data-testid="widget-activity"
          :class="staggerClass('delay-300')"
        >
          <DashboardActivityColumn :transaction-limit="MOBILE_TX_LIMIT" />
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
            @setup="openBudgetSheet"
            @edit="openBudgetSheet"
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
              @click="openDashboardSettings"
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
</template>
