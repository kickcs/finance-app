<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import type { AccountWithBalances } from '@/entities/account';
import type { Debt } from '@/entities/debt';
import type { Reminder } from '@/entities/reminder';
import type { QuickAction } from '@/features/configure-quick-action';
import { AccountStack } from '@/widgets/account-stack';
import { DebtsSectionSkeleton } from '@/widgets/debts-section';
import { RemindersSectionSkeleton } from '@/widgets/reminders-section';
import DashboardQuickActions from './DashboardQuickActions.vue';

defineProps<{
  // Quick Actions
  quickActionSlots: (QuickAction | null)[];
  categoryMap: Map<string, { icon: string; color: string }>;
  hintDismissed: boolean;
  quickActionsHidden: boolean;
  // Accounts
  accounts: AccountWithBalances[];
  accountsLoading: boolean;
  // Debts
  debts: Debt[];
  currency: string;
  debtsLoading: boolean;
  // Reminders
  reminders: Reminder[];
  remindersLoading: boolean;
  // Shared
  isHidden: boolean;
}>();

const emit = defineEmits<{
  // Quick Actions
  'quick-action-click': [action: QuickAction | null];
  'quick-action-long-press': [action: QuickAction | null];
  'dismiss-hint': [];
  'settings-click': [];
  // Accounts
  'account-click': [account: AccountWithBalances];
  'add-account': [];
  'view-all-accounts': [];
  // Debts
  'debt-click': [debt: Debt];
  'person-click': [person: string, type: 'given' | 'taken'];
  'add-debt': [];
  'view-all-debts': [];
  // Reminders
  'reminder-click': [reminder: Reminder];
  'add-reminder': [];
  'view-all-reminders': [];
}>();

const DebtsSection = defineAsyncComponent({
  loader: () => import('@/widgets/debts-section').then((m) => m.DebtsSection),
  delay: 0,
});
const RemindersSection = defineAsyncComponent({
  loader: () => import('@/widgets/reminders-section').then((m) => m.RemindersSection),
  delay: 0,
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Quick Actions -->
    <section>
      <DashboardQuickActions
        :slots="quickActionSlots"
        :category-map="categoryMap"
        :hint-dismissed="hintDismissed"
        :hidden="quickActionsHidden"
        @click="emit('quick-action-click', $event)"
        @long-press="emit('quick-action-long-press', $event)"
        @dismiss-hint="emit('dismiss-hint')"
        @settings-click="emit('settings-click')"
      />
    </section>

    <!-- Accounts -->
    <section>
      <AccountStack
        :accounts="accounts"
        :loading="accountsLoading"
        :hidden="isHidden"
        class="hover:shadow-md transition-shadow duration-300 rounded-3xl"
        @account-click="emit('account-click', $event)"
        @add-click="emit('add-account')"
        @view-all="emit('view-all-accounts')"
      />
    </section>

    <!-- Debts -->
    <section>
      <Suspense>
        <DebtsSection
          :debts="debts"
          :currency="currency"
          :loading="debtsLoading"
          :hidden="isHidden"
          class="hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-300 rounded-3xl"
          @debt-click="emit('debt-click', $event)"
          @person-click="(person: string, type: 'given' | 'taken') => emit('person-click', person, type)"
          @add-click="emit('add-debt')"
          @view-all="emit('view-all-debts')"
        />
        <template #fallback>
          <DebtsSectionSkeleton />
        </template>
      </Suspense>
    </section>

    <!-- Reminders -->
    <section>
      <Suspense>
        <RemindersSection
          :reminders="reminders"
          :currency="currency"
          :loading="remindersLoading"
          :hidden="isHidden"
          class="hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-300 rounded-3xl"
          @reminder-click="emit('reminder-click', $event)"
          @add-click="emit('add-reminder')"
          @view-all="emit('view-all-reminders')"
        />
        <template #fallback>
          <RemindersSectionSkeleton />
        </template>
      </Suspense>
    </section>
  </div>
</template>
