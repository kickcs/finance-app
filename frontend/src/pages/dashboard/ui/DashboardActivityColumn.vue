<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import type { Transaction } from '@/entities/transaction';
import type { Debt } from '@/entities/debt';
import type { WidgetId } from '@/shared/api/database.types';
import { ACTIVITY_WIDGET_IDS } from '@/shared/config/dashboard';
import { DebtsSectionSkeleton } from '@/widgets/debts-section';
import { RecentTransactionsSkeleton } from '@/widgets/recent-transactions';
import { UpcomingSubscriptionsSkeleton } from '@/widgets/upcoming-subscriptions';

const props = withDefaults(
  defineProps<{
    transactions: Transaction[];
    debts: Debt[];
    userId: string | null;
    currency: string;
    isHidden: boolean;
    recentTxLoading: boolean;
    debtsLoading: boolean;
    hiddenWidgets?: Set<WidgetId>;
    widgetOrder?: WidgetId[];
  }>(),
  {
    hiddenWidgets: () => new Set<WidgetId>(),
    widgetOrder: () => ['transactions', 'debts'] as WidgetId[],
  },
);

const emit = defineEmits<{
  'transaction-click': [tx: Transaction];
  'add-transaction': [];
  'view-all-transactions': [];
  'debt-click': [debt: Debt];
  'person-click': [person: string, type: 'given' | 'taken'];
  'add-debt': [];
  'view-all-debts': [];
  'subscription-click': [id: string];
  'add-subscription': [];
  'view-all-subscriptions': [];
}>();

const orderedWidgets = computed(() =>
  props.widgetOrder.filter(
    (id): id is 'transactions' | 'debts' | 'subscriptions' =>
      ACTIVITY_WIDGET_IDS.has(id) && !props.hiddenWidgets.has(id),
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
      <!-- Recent Transactions -->
      <section v-if="widgetId === 'transactions'" class="flex-1">
        <Suspense>
          <RecentTransactions
            :transactions="transactions"
            :user-id="userId ?? ''"
            :loading="recentTxLoading"
            :hidden="isHidden"
            class="h-full"
            @transaction-click="emit('transaction-click', $event)"
            @add-click="emit('add-transaction')"
            @view-all="emit('view-all-transactions')"
          />
          <template #fallback>
            <RecentTransactionsSkeleton />
          </template>
        </Suspense>
      </section>

      <!-- Debts (mobile only — on desktop rendered via DashboardSidePanel) -->
      <section v-if="widgetId === 'debts'" class="grid grid-cols-1 md:hidden">
        <Suspense>
          <DebtsSection
            :debts="debts"
            :currency="currency"
            :loading="debtsLoading"
            :hidden="isHidden"
            class="md:hover:-translate-y-1 md:hover:shadow-md transition-[transform,box-shadow] duration-300 rounded-3xl"
            @debt-click="emit('debt-click', $event)"
            @person-click="
              (person: string, type: 'given' | 'taken') => emit('person-click', person, type)
            "
            @add-click="emit('add-debt')"
            @view-all="emit('view-all-debts')"
          />
          <template #fallback>
            <DebtsSectionSkeleton />
          </template>
        </Suspense>
      </section>

      <!-- Subscriptions -->
      <section v-if="widgetId === 'subscriptions'" class="grid grid-cols-1">
        <Suspense>
          <UpcomingSubscriptions
            :user-id="userId ?? ''"
            @subscription-click="emit('subscription-click', $event)"
            @add-click="emit('add-subscription')"
            @view-all="emit('view-all-subscriptions')"
          />
          <template #fallback>
            <UpcomingSubscriptionsSkeleton />
          </template>
        </Suspense>
      </section>
    </template>
  </div>
</template>
