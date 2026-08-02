<script setup lang="ts">
import type { AccountWithBalances } from '@/entities/account';
import type { Category } from '@/entities/category';
import type { BudgetCurrentResponse } from '@/entities/budget';
import { InstallPwaModal } from '@/features/install-pwa';
import {
  QuickActionModal,
  type QuickAction,
  type QuickActionPayload,
} from '@/features/configure-quick-action';
import { FinancialPeriodModal } from '@/features/configure-financial-period';
import { SetBudgetSheet } from '@/features/set-budget';

/**
 * Четыре модалки Главной, общие для мобильной и десктопной страниц:
 * PWA-инсталляция, быстрое действие, финансовый период, бюджет. Всё, чего нет
 * в DashboardContext, приходит пропами.
 */
defineProps<{
  showInstallModal: boolean;
  showQuickActionModal: boolean;
  showFinancialPeriodModal: boolean;
  showBudgetSheet: boolean;
  accounts: AccountWithBalances[];
  expenseCategories: Category[];
  editingAction: QuickAction | null;
  budget: BudgetCurrentResponse | null;
  budgetSaving: boolean;
}>();

const emit = defineEmits<{
  'update:showInstallModal': [value: boolean];
  'update:showQuickActionModal': [value: boolean];
  'update:showFinancialPeriodModal': [value: boolean];
  'update:showBudgetSheet': [value: boolean];
  'quick-action-save': [action: QuickActionPayload];
  'quick-action-delete': [];
  'budget-save': [amount: number];
  'budget-reset': [];
}>();
</script>

<template>
  <InstallPwaModal
    :model-value="showInstallModal"
    @update:model-value="emit('update:showInstallModal', $event)"
  />

  <QuickActionModal
    :model-value="showQuickActionModal"
    :accounts="accounts"
    :expense-categories="expenseCategories"
    :edit-action="editingAction"
    @update:model-value="emit('update:showQuickActionModal', $event)"
    @save="emit('quick-action-save', $event)"
    @delete="emit('quick-action-delete')"
  />

  <FinancialPeriodModal
    :model-value="showFinancialPeriodModal"
    @update:model-value="emit('update:showFinancialPeriodModal', $event)"
  />

  <SetBudgetSheet
    :model-value="showBudgetSheet"
    :current-amount="budget?.budget?.amount"
    :is-override="budget?.budget?.isDefault === false"
    :is-saving="budgetSaving"
    @update:model-value="emit('update:showBudgetSheet', $event)"
    @save="emit('budget-save', $event)"
    @reset="emit('budget-reset')"
  />
</template>
