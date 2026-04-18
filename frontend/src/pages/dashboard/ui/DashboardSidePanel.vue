<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { AccountStack } from '@/widgets/account-stack';
import { BudgetSection, BudgetSectionSkeleton } from '@/widgets/budget-section';
import { DebtsSectionSkeleton } from '@/widgets/debts-section';
import { UpcomingSubscriptionsSkeleton } from '@/widgets/upcoming-subscriptions';
import { UIcon, DiscoveryDot } from '@/shared/ui';
import { SIDE_PANEL_WIDGET_IDS } from '@/shared/config/dashboard';
import DashboardQuickActions from './DashboardQuickActions.vue';
import DashboardTopExpenses from './DashboardTopExpenses.vue';
import DashboardCompactToggle from './DashboardCompactToggle.vue';
import { useDashboardContext } from '../model/dashboardContext';

const {
  visibleAccounts,
  hiddenAccountCount,
  accountsLoading,
  categoryBreakdown,
  analyticsLoading,
  debts,
  debtsLoading,
  currency,
  userId,
  budget,
  budgetLoading,
  isHidden,
  widgetOrder,
  hiddenWidgets,
  showSettingsDot,
  nav,
  openBudgetSheet,
  openFinancialPeriodModal,
  openDashboardSettings,
} = useDashboardContext();

const orderedWidgets = computed(() =>
  widgetOrder.value.filter((id) => SIDE_PANEL_WIDGET_IDS.has(id) && !hiddenWidgets.value.has(id)),
);

const DebtsSection = defineAsyncComponent({
  loader: () => import('@/widgets/debts-section').then((m) => m.DebtsSection),
  delay: 0,
});
const UpcomingSubscriptions = defineAsyncComponent({
  loader: () => import('@/widgets/upcoming-subscriptions').then((m) => m.UpcomingSubscriptions),
  delay: 0,
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <template v-for="widgetId in orderedWidgets" :key="widgetId">
      <section v-if="widgetId === 'quick_actions'">
        <DashboardQuickActions />
      </section>

      <section v-else-if="widgetId === 'budget'">
        <Suspense>
          <BudgetSection
            :budget="budget"
            :loading="budgetLoading"
            :hidden="isHidden"
            class="hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-300 rounded-2xl"
            @setup="openBudgetSheet"
            @edit="openBudgetSheet"
          />
          <template #fallback>
            <BudgetSectionSkeleton />
          </template>
        </Suspense>
      </section>

      <section v-else-if="widgetId === 'accounts'">
        <AccountStack
          :accounts="visibleAccounts"
          :loading="accountsLoading"
          :hidden="isHidden"
          :hidden-count="hiddenAccountCount"
          class="hover:shadow-md transition-shadow duration-300 rounded-3xl"
          @account-click="nav.toAccount"
          @add-click="nav.toNewAccount"
          @view-all="nav.toAccounts"
        />
      </section>

      <section v-else-if="widgetId === 'top_expenses'">
        <DashboardTopExpenses
          :category-breakdown="categoryBreakdown"
          :currency="currency"
          :loading="analyticsLoading"
          :is-hidden="isHidden"
          @configure-period="openFinancialPeriodModal"
        />
      </section>

      <section v-else-if="widgetId === 'debts'">
        <Suspense>
          <DebtsSection
            :debts="debts"
            :currency="currency"
            :loading="debtsLoading"
            :hidden="isHidden"
            class="hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-300 rounded-3xl"
            @debt-click="nav.toDebt"
            @person-click="nav.toDebts"
            @add-click="nav.toNewDebt"
            @view-all="nav.toDebts"
          />
          <template #fallback>
            <DebtsSectionSkeleton />
          </template>
        </Suspense>
      </section>

      <section v-else-if="widgetId === 'subscriptions'">
        <Suspense>
          <UpcomingSubscriptions
            :user-id="userId ?? ''"
            class="hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-300 rounded-2xl"
            @subscription-click="nav.toSubscription"
            @add-click="nav.toNewSubscription"
            @view-all="nav.toSubscriptions"
          />
          <template #fallback>
            <UpcomingSubscriptionsSkeleton />
          </template>
        </Suspense>
      </section>
    </template>

    <div class="flex justify-center items-center gap-2 mt-2 pb-4 md:pb-0">
      <DashboardCompactToggle variant="inline" />
      <div class="relative">
        <button
          type="button"
          class="flex items-center gap-2 text-body-sm font-medium text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark transition-colors px-4 py-2 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark"
          @click="openDashboardSettings"
        >
          <UIcon name="tune" size="sm" />
          Настроить вид дашборда
        </button>
        <DiscoveryDot :show="showSettingsDot" />
      </div>
    </div>
  </div>
</template>
