<script setup lang="ts">
import { BalanceCard } from '@/widgets/balance-card';
import { PushNotificationBanner } from '@/widgets/push-notification-banner';
import DashboardActivityColumn from './DashboardActivityColumn.vue';
import DashboardSidePanel from './DashboardSidePanel.vue';
import { useDashboardContext } from '../model/dashboardContext';
import { useStaggerAnimation } from '../model/useStaggerAnimation';

const {
  totalBalance,
  currency,
  avgDailyExpense,
  safeDailyLimit,
  daysRemainingInMonth,
  recentTransactions,
  isHidden,
  balanceLoading,
  nav,
  toggleHidden,
} = useDashboardContext();

const { staggerClass } = useStaggerAnimation();
</script>

<template>
  <div class="grid grid-cols-12 gap-6">
    <div class="col-span-8 flex flex-col gap-6">
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

      <section :class="staggerClass('delay-150')">
        <DashboardActivityColumn
          class="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-6"
        />
      </section>
    </div>

    <div class="col-span-4 self-start sticky top-6">
      <section :class="staggerClass('delay-200')">
        <DashboardSidePanel />
      </section>
    </div>
  </div>
</template>
