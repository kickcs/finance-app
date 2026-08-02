<script setup lang="ts">
import { ref, watch } from 'vue';
import { PageContainer } from '@/shared/ui';
import { InstallPwaBanner } from '@/features/install-pwa';

import { useDashboardPage } from './model/useDashboardPage';

import DashboardMobileHeader from './ui/DashboardMobileHeader.vue';
import DashboardCompactView from './ui/DashboardCompactView.vue';
import DashboardStandardMobile from './ui/DashboardStandardMobile.vue';
import DashboardModals from './ui/DashboardModals.vue';

const {
  greeting,
  userName,
  isHidden,
  isCompactMode,
  showInstallModal,
  showBudgetSheet,
  showFinancialPeriodModal,
  showSettingsDot,
  showSettingsHint,
  settingsHintConfig,
  isScrolledPastBalance,
  setScrollContainer,
  handleSettingsClick,
  dismissSettingsHint,
  handleSettingsHintAction,
  handleBudgetSave,
  handleBudgetReset,
  quickActions,
  data,
  nav,
} = useDashboardPage();

const { totalBalance, currency, accounts, expenseCategories, budget, budgetSaving } = data;
const { showQuickActionModal, editingAction, handleSave, handleDelete } = quickActions;

// Скролл-контейнер приходит из PageContainer — десктопная страница берёт его
// из DesktopPage тем же приёмом.
const pageContainerRef = ref<InstanceType<typeof PageContainer>>();
watch(
  () => pageContainerRef.value?.scrollRef,
  (el) => setScrollContainer(el),
  { immediate: true },
);
</script>

<template>
  <PageContainer ref="pageContainerRef" class="min-w-0 relative">
    <template #header>
      <DashboardMobileHeader
        :user-name="userName"
        :greeting="greeting"
        :total-balance="totalBalance"
        :currency="currency"
        :is-hidden="isHidden"
        :is-scrolled-past-balance="isScrolledPastBalance"
        :show-settings-dot="showSettingsDot"
        :show-settings-hint="showSettingsHint"
        :settings-hint-config="settingsHintConfig"
        @profile-click="nav.toProfile"
        @settings-click="handleSettingsClick"
        @balance-click="nav.toAccounts"
        @hint-dismiss="dismissSettingsHint"
        @hint-action="handleSettingsHintAction"
      />
    </template>

    <main data-testid="dashboard-main" class="relative z-10 pt-3 pb-28">
      <div class="mb-6">
        <InstallPwaBanner @install="showInstallModal = true" />
      </div>

      <DashboardCompactView v-if="isCompactMode" />
      <DashboardStandardMobile v-else />
    </main>

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
  </PageContainer>
</template>
