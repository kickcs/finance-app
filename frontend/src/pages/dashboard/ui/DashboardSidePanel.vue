<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import type { AccountWithBalances } from '@/entities/account';
import type { Debt } from '@/entities/debt';
import type { Reminder } from '@/entities/reminder';
import type { QuickAction } from '@/features/configure-quick-action';
import type { WidgetId } from '@/shared/api/database.types';
import { DEFAULT_WIDGET_ORDER } from '@/shared/config/dashboard';
import { AccountStack } from '@/widgets/account-stack';
import { DebtsSectionSkeleton } from '@/widgets/debts-section';
import { RemindersSectionSkeleton } from '@/widgets/reminders-section';
import { UIcon } from '@/shared/ui';
import DashboardQuickActions from './DashboardQuickActions.vue';

const props = withDefaults(
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
    // Dashboard settings
    hiddenWidgets?: Set<WidgetId>;
    widgetOrder?: WidgetId[];
  }>(),
  {
    hiddenWidgets: () => new Set<WidgetId>(),
    widgetOrder: () => DEFAULT_WIDGET_ORDER,
  },
);

const emit = defineEmits<{
  // Quick Actions
  'quick-action-click': [action: QuickAction | null];
  'quick-action-long-press': [action: QuickAction | null];
  'dismiss-hint': [];
  'settings-click': [];
  'scan-click': [];
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
  'dashboard-settings-click': [];
}>();

const sidePanelWidgets = computed(() =>
  (['quick_actions', 'accounts', 'debts', 'reminders'] as const).filter(
    (id) => props.widgetOrder.includes(id) && !props.hiddenWidgets.has(id),
  ),
);

const orderedWidgets = computed(() =>
  sidePanelWidgets.value.slice().sort((a, b) => {
    const orderA = props.widgetOrder.indexOf(a);
    const orderB = props.widgetOrder.indexOf(b);
    return orderA - orderB;
  }),
);

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
    <template v-for="widgetId in orderedWidgets" :key="widgetId">
      <!-- Quick Actions -->
      <section v-if="widgetId === 'quick_actions'">
        <DashboardQuickActions
          :slots="quickActionSlots"
          :category-map="categoryMap"
          :hint-dismissed="hintDismissed"
          :hidden="quickActionsHidden"
          show-scan-button
          @click="emit('quick-action-click', $event)"
          @long-press="emit('quick-action-long-press', $event)"
          @dismiss-hint="emit('dismiss-hint')"
          @settings-click="emit('settings-click')"
          @scan-click="emit('scan-click')"
        />
      </section>

      <!-- Accounts -->
      <section v-if="widgetId === 'accounts'">
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
      <section v-if="widgetId === 'debts'">
        <Suspense>
          <DebtsSection
            :debts="debts"
            :currency="currency"
            :loading="debtsLoading"
            :hidden="isHidden"
            class="hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-300 rounded-3xl"
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

      <!-- Reminders -->
      <section v-if="widgetId === 'reminders'">
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
    </template>

    <div class="flex justify-center mt-2 pb-4 md:pb-0">
      <button
        type="button"
        class="flex items-center gap-2 text-[13px] font-medium text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark transition-colors px-4 py-2 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark"
        @click="emit('dashboard-settings-click')"
      >
        <UIcon name="tune" size="sm" />
        Настроить вид дашборда
      </button>
    </div>
  </div>
</template>
