<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { BudgetSection, BudgetSectionSkeleton } from '@/widgets/budget-section';
import { DebtsSectionSkeleton } from '@/widgets/debts-section';
import { UpcomingSubscriptionsSkeleton } from '@/widgets/upcoming-subscriptions';
import { SIDE_PANEL_WIDGET_IDS } from '@/shared/config/dashboard';
import DashboardQuickActions from '../ui/DashboardQuickActions.vue';
import DashboardTopExpenses from '../ui/DashboardTopExpenses.vue';
import { useDashboardContext } from '../model/dashboardContext';

const {
  categoryBreakdown,
  analyticsLoading,
  debts,
  debtsLoading,
  currency,
  convert,
  userId,
  budget,
  budgetLoading,
  isHidden,
  widgetOrder,
  hiddenWidgets,
  nav,
  openBudgetSheet,
  openFinancialPeriodModal,
} = useDashboardContext();

// 'accounts' переехали в сетку основной колонки (см. DashboardDesktopPage) —
// в боковой панели их больше нет, иначе счета задублируются на странице.
const orderedWidgets = computed(() =>
  widgetOrder.value.filter(
    (id) => SIDE_PANEL_WIDGET_IDS.has(id) && id !== 'accounts' && !hiddenWidgets.value.has(id),
  ),
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

      <section v-else-if="widgetId === 'top_expenses'">
        <DashboardTopExpenses
          :category-breakdown="categoryBreakdown"
          :currency="currency"
          :convert="convert"
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
            class="hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-300 rounded-xl"
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
            :hidden="isHidden"
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
  </div>
</template>
