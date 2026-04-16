<script setup lang="ts">
import type { WidgetId } from '@/shared/api/database.types';
import { PullToRefresh } from '@/shared/ui';
import { useDashboardContext } from '../model/dashboardContext';
import CompactBalanceCard from './compact/CompactBalanceCard.vue';
import CompactStatsRow from './compact/CompactStatsRow.vue';
import CompactQuickActions from './compact/CompactQuickActions.vue';
import CompactAccounts from './compact/CompactAccounts.vue';
import CompactTopExpenses from './compact/CompactTopExpenses.vue';
import CompactBudget from './compact/CompactBudget.vue';
import CompactTransactions from './compact/CompactTransactions.vue';
import CompactDebts from './compact/CompactDebts.vue';
import CompactSubscriptions from './compact/CompactSubscriptions.vue';
import CompactSettingsLink from './compact/CompactSettingsLink.vue';

const {
  widgetOrder,
  hiddenWidgets,
  quickActionSlots,
  quickActionsLoading,
  visibleAccounts,
  accountsLoading,
  onRefresh,
  scrollContainerRef,
} = useDashboardContext();

function isVisible(id: WidgetId): boolean {
  return !hiddenWidgets.value.has(id);
}
</script>

<template>
  <PullToRefresh :on-refresh="onRefresh" :container-ref="scrollContainerRef">
    <div
      data-testid="dashboard-compact-layout"
      class="flex flex-col space-y-3 md:max-w-[640px] md:mx-auto"
    >
      <CompactBalanceCard />
      <CompactStatsRow />

      <template v-for="widgetId in widgetOrder" :key="widgetId">
        <CompactQuickActions
          v-if="
            widgetId === 'quick_actions' &&
            isVisible('quick_actions') &&
            (quickActionsLoading || quickActionSlots.length > 0)
          "
        />

        <CompactAccounts
          v-else-if="
            widgetId === 'accounts' &&
            isVisible('accounts') &&
            (accountsLoading || visibleAccounts.length > 0)
          "
        />

        <CompactTopExpenses v-else-if="widgetId === 'top_expenses' && isVisible('top_expenses')" />

        <CompactBudget v-else-if="widgetId === 'budget' && isVisible('budget')" />

        <CompactTransactions v-else-if="widgetId === 'transactions' && isVisible('transactions')" />

        <CompactDebts v-else-if="widgetId === 'debts' && isVisible('debts')" />

        <CompactSubscriptions
          v-else-if="widgetId === 'subscriptions' && isVisible('subscriptions')"
        />
      </template>

      <CompactSettingsLink />
    </div>
  </PullToRefresh>
</template>
