<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { ACTIVITY_WIDGET_IDS } from '@/shared/config/dashboard';
import { DebtsSectionSkeleton } from '@/widgets/debts-section';
import { RecentTransactionsSkeleton } from '@/widgets/recent-transactions';
import { UpcomingSubscriptionsSkeleton } from '@/widgets/upcoming-subscriptions';
import { useDashboardContext } from '../model/dashboardContext';

const props = defineProps<{
  /** Optional cap on how many transactions to render (mobile shows fewer than desktop). */
  transactionLimit?: number;
}>();

const {
  debts,
  userId,
  currency,
  isHidden,
  recentTransactions,
  recentTxLoading,
  debtsLoading,
  widgetOrder,
  hiddenWidgets,
  nav,
} = useDashboardContext();

const visibleTransactions = computed(() =>
  props.transactionLimit !== undefined
    ? recentTransactions.value.slice(0, props.transactionLimit)
    : recentTransactions.value,
);

const orderedWidgets = computed(() =>
  widgetOrder.value.filter(
    (id): id is 'transactions' | 'debts' | 'subscriptions' =>
      ACTIVITY_WIDGET_IDS.has(id) && !hiddenWidgets.value.has(id),
  ),
);

const RecentTransactions = defineAsyncComponent({
  loader: () => import('@/widgets/recent-transactions').then((m) => m.RecentTransactions),
  delay: 0,
});
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
  <div class="flex flex-col space-y-6 md:space-y-8">
    <template v-for="widgetId in orderedWidgets" :key="widgetId">
      <section v-if="widgetId === 'transactions'" class="flex-1">
        <Suspense>
          <RecentTransactions
            :transactions="visibleTransactions"
            :user-id="userId ?? ''"
            :loading="recentTxLoading"
            :hidden="isHidden"
            class="h-full"
            @transaction-click="nav.toHistory"
            @add-click="nav.toNewTransaction()"
            @view-all="nav.toHistory"
          />
          <template #fallback>
            <RecentTransactionsSkeleton />
          </template>
        </Suspense>
      </section>

      <section v-else-if="widgetId === 'debts'" class="grid grid-cols-1 md:hidden">
        <Suspense>
          <DebtsSection
            :debts="debts"
            :currency="currency"
            :loading="debtsLoading"
            :hidden="isHidden"
            class="md:hover:-translate-y-1 md:hover:shadow-md transition-[transform,box-shadow] duration-300 rounded-3xl"
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

      <section v-else-if="widgetId === 'subscriptions'" class="grid grid-cols-1 md:hidden">
        <Suspense>
          <UpcomingSubscriptions
            :user-id="userId ?? ''"
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
