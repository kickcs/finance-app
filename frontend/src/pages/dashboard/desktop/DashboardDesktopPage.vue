<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { DesktopPage, DesktopColumns } from '@/shared/ui/desktop-page';
import { SectionHeader, EmptyState, Skeleton } from '@/shared/ui';
import { BalanceCard } from '@/widgets/balance-card';
import { PushNotificationBanner } from '@/widgets/push-notification-banner';
import { RecentTransactions, RecentTransactionsSkeleton } from '@/widgets/recent-transactions';
import { AccountCard } from '@/entities/account';
import { InstallPwaBanner } from '@/features/install-pwa';

import { useDashboardPage } from '../model/useDashboardPage';
import DashboardModals from '../ui/DashboardModals.vue';
import DashboardDesktopHeader from './DashboardDesktopHeader.vue';
import DashboardDesktopSidePanel from './DashboardDesktopSidePanel.vue';

/**
 * Что показывает основная колонка. Остальное разбирает боковая панель
 * (SIDE_PANEL_WIDGET_IDS), баланс закреплён сверху и в порядок не входит —
 * ровно как на мобильной странице.
 */
const MAIN_COLUMN_WIDGET_IDS: ReadonlySet<string> = new Set(['accounts', 'transactions']);

const {
  greeting,
  userName,
  isHidden,
  showInstallModal,
  showBudgetSheet,
  showFinancialPeriodModal,
  showSettingsDot,
  showSettingsHint,
  settingsHintConfig,
  setScrollContainer,
  handleSettingsClick,
  dismissSettingsHint,
  handleSettingsHintAction,
  handleBudgetSave,
  handleBudgetReset,
  toggleHidden,
  quickActions,
  data,
  nav,
} = useDashboardPage();

const {
  totalBalance,
  currency,
  avgDailyExpense,
  safeDailyLimit,
  daysRemainingInMonth,
  balanceLoading,
  visibleAccounts,
  hiddenAccountCount,
  accountsLoading,
  recentTransactions,
  recentTxLoading,
  userId,
  accounts,
  expenseCategories,
  budget,
  budgetSaving,
  widgetOrder,
  hiddenWidgets,
} = data;
const { showQuickActionModal, editingAction, handleSave, handleDelete } = quickActions;

// Порядок блоков — из настроек дашборда, тех же, что и на телефоне. Жёсткая
// последовательность здесь означала бы, что настройка «Вид дашборда» на
// компьютере молча не работает.
const mainWidgets = computed(() =>
  widgetOrder.value.filter((id) => MAIN_COLUMN_WIDGET_IDS.has(id) && !hiddenWidgets.value.has(id)),
);

// Скролл-контейнер приходит из DesktopPage — мобильная страница берёт его из
// PageContainer тем же приёмом (см. useDashboardPage.setScrollContainer).
const pageRef = ref<InstanceType<typeof DesktopPage>>();
watch(
  () => pageRef.value?.scrollRef,
  (el) => setScrollContainer(el),
  { immediate: true },
);
</script>

<template>
  <div class="h-full flex flex-col">
    <DashboardDesktopHeader
      :user-name="userName"
      :greeting="greeting"
      :show-settings-dot="showSettingsDot"
      :show-settings-hint="showSettingsHint"
      :settings-hint-config="settingsHintConfig"
      @period-click="showFinancialPeriodModal = true"
      @settings-click="handleSettingsClick"
      @hint-dismiss="dismissSettingsHint"
      @hint-action="handleSettingsHintAction"
    />

    <DesktopPage ref="pageRef" class="flex-1 min-h-0">
      <div class="mb-6">
        <InstallPwaBanner @install="showInstallModal = true" />
      </div>

      <DesktopColumns>
        <template #main>
          <div data-testid="dashboard-desktop-main" class="flex flex-col gap-6">
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

            <PushNotificationBanner :transaction-count="recentTransactions.length" />

            <template v-for="widgetId in mainWidgets" :key="widgetId">
              <section v-if="widgetId === 'accounts'">
                <SectionHeader
                  title="Счета"
                  :count="visibleAccounts.length"
                  :show-view-all="visibleAccounts.length > 0"
                  @add-click="nav.toNewAccount"
                  @view-all="nav.toAccounts"
                />

                <div v-if="accountsLoading" class="mt-3 grid grid-cols-2 gap-3">
                  <Skeleton v-for="i in 4" :key="i" class="h-16 rounded-xl" />
                </div>

                <div v-else-if="visibleAccounts.length > 0" class="mt-3 grid grid-cols-2 gap-3">
                  <AccountCard
                    v-for="account in visibleAccounts"
                    :key="account.id"
                    :account="account"
                    :hidden="isHidden"
                    @click="nav.toAccount(account)"
                  />
                </div>

                <EmptyState
                  v-else
                  variant="inline"
                  icon="account_balance_wallet"
                  title="У вас пока нет счетов"
                  description="Добавьте первый счёт для начала"
                  :action="{ label: 'Создать счёт', onClick: () => nav.toNewAccount() }"
                  class="mt-3"
                />

                <p
                  v-if="hiddenAccountCount > 0"
                  class="mt-2 text-body-sm text-text-tertiary-light dark:text-text-tertiary-dark text-center"
                >
                  {{ hiddenAccountCount }} скрыто
                </p>
              </section>

              <section v-else-if="widgetId === 'transactions'">
                <Suspense>
                  <RecentTransactions
                    :transactions="recentTransactions"
                    :user-id="userId ?? ''"
                    :loading="recentTxLoading"
                    :hidden="isHidden"
                    @transaction-click="nav.toHistory"
                    @add-click="nav.toNewTransaction()"
                    @view-all="nav.toHistory"
                  />
                  <template #fallback>
                    <RecentTransactionsSkeleton />
                  </template>
                </Suspense>
              </section>
            </template>
          </div>
        </template>

        <template #aside>
          <div data-testid="dashboard-desktop-aside">
            <DashboardDesktopSidePanel />
          </div>
        </template>
      </DesktopColumns>
    </DesktopPage>

    <DashboardModals
      v-model:show-install-modal="showInstallModal"
      v-model:show-quick-action-modal="showQuickActionModal"
      v-model:show-financial-period-modal="showFinancialPeriodModal"
      v-model:show-budget-sheet="showBudgetSheet"
      :accounts="accounts"
      :expense-categories="expenseCategories"
      :editing-action="editingAction"
      :budget="budget"
      :budget-saving="budgetSaving"
      @quick-action-save="handleSave"
      @quick-action-delete="handleDelete"
      @budget-save="handleBudgetSave"
      @budget-reset="handleBudgetReset"
    />
  </div>
</template>
