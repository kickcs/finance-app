<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import type { Transaction } from '@/entities/transaction';
import type { Debt } from '@/entities/debt';
import type { Reminder } from '@/entities/reminder';
import { DebtsSectionSkeleton } from '@/widgets/debts-section';
import { RemindersSectionSkeleton } from '@/widgets/reminders-section';
import { RecentTransactionsSkeleton } from '@/widgets/recent-transactions';

defineProps<{
  transactions: Transaction[];
  debts: Debt[];
  reminders: Reminder[];
  userId: string | null;
  currency: string;
  isHidden: boolean;
  recentTxLoading: boolean;
  debtsLoading: boolean;
  remindersLoading: boolean;
}>();

const emit = defineEmits<{
  'transaction-click': [tx: Transaction];
  'add-transaction': [];
  'view-all-transactions': [];
  'debt-click': [debt: Debt];
  'person-click': [person: string, type: 'given' | 'taken'];
  'add-debt': [];
  'view-all-debts': [];
  'reminder-click': [reminder: Reminder];
  'add-reminder': [];
  'view-all-reminders': [];
}>();
const RecentTransactions = defineAsyncComponent({
  loader: () => import('@/widgets/recent-transactions').then((m) => m.RecentTransactions),
  delay: 0,
});
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
  <div class="flex flex-col space-y-6 md:space-y-8">
    <!-- Recent Transactions -->
    <section class="flex-1">
      <Suspense>
        <RecentTransactions
          :transactions="transactions"
          :user-id="userId ?? ''"
          :loading="recentTxLoading"
          :hidden="isHidden"
          class="h-full md:bg-surface-light md:dark:bg-surface-dark md:rounded-3xl md:p-6 md:border md:border-border-light md:dark:border-border-dark md:shadow-sm"
          @transaction-click="emit('transaction-click', $event)"
          @add-click="emit('add-transaction')"
          @view-all="emit('view-all-transactions')"
        />
        <template #fallback>
          <RecentTransactionsSkeleton />
        </template>
      </Suspense>
    </section>

    <!-- Secondary Grid: Debts & Reminders -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
      <section>
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

      <section>
        <Suspense>
          <RemindersSection
            :reminders="reminders"
            :currency="currency"
            :loading="remindersLoading"
            :hidden="isHidden"
            class="md:hover:-translate-y-1 md:hover:shadow-md transition-[transform,box-shadow] duration-300 rounded-3xl"
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
  </div>
</template>
