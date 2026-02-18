<script setup lang="ts">
import { computed } from 'vue';
import { UInput, UButton, UTabs } from '@/shared/ui';
import type { Category } from '@/entities/category';
import type { AccountWithBalances } from '@/entities/account';
import type { SplitExpenseData, SplitMethod } from '@/features/split-expense';
import type { TransactionFormData } from '../model/useTransactionForm';
import {
  useScrollableTabs,
  CYCLIC_PANEL_ORDER,
  TRANSACTION_TYPE_ORDER,
  type TransactionType,
} from '../model/useScrollableTabs';
import ExpensePanel from './ExpensePanel.vue';
import IncomePanel from './IncomePanel.vue';
import TransferPanel from './TransferPanel.vue';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  userCurrency?: string;
  isSubmitting?: boolean;
  isValid?: boolean;
  error?: string | null;
  splitData?: SplitExpenseData;
  splitValidationError?: string | null;
  autofocusAmount?: boolean;
}>();

const emit = defineEmits<{
  'update:formData': [value: TransactionFormData];
  submit: [];
  addParticipant: [name: string];
  removeParticipant: [id: string];
  updateParticipantAmount: [id: string, amount: number];
  updateParticipantName: [id: string, name: string];
  setSplitMethod: [method: SplitMethod];
  setMyShare: [amount: number];
  setSplitEnabled: [enabled: boolean];
}>();

const tabItems = [
  { id: 'expense', label: 'Расход' },
  { id: 'income', label: 'Доход' },
  { id: 'transfer', label: 'Перевод' },
];

const type = computed(() => props.formData.type);

function applyTypeChange(newType: string) {
  emit('update:formData', {
    ...props.formData,
    type: newType as 'income' | 'expense' | 'transfer',
    categoryId: newType === 'transfer' ? 'transfer' : '',
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
  });
}

const { scrollContainer, handleTabClick, handleScrollEnd, handleScroll } =
  useScrollableTabs(type, applyTypeChange);

// Only real panels (not clones) get autofocus — clones are at index 0 and last
const realPanelIndices = new Set(
  TRANSACTION_TYPE_ORDER.map((_, i) => i + 1),
);

const submitLabel = computed(() => {
  if (props.formData.type === 'transfer') return 'Перевести';
  if (props.formData.type === 'income') return 'Добавить доход';
  return 'Добавить расход';
});
</script>

<template>
  <form
    class="space-y-4 transition-opacity duration-200"
    :class="isSubmitting && 'opacity-60 pointer-events-none'"
    @submit.prevent="$emit('submit')"
  >
    <!-- Type Tabs -->
    <UTabs
      :model-value="formData.type"
      :items="tabItems"
      @update:model-value="(v: string) => handleTabClick(v as TransactionType)"
    />

    <!-- Swipeable panels -->
    <div
      ref="scrollContainer"
      class="flex overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4"
      @scrollend="handleScrollEnd"
      @scroll="handleScroll"
    >
      <div
        v-for="(panelType, idx) in CYCLIC_PANEL_ORDER"
        :key="`${panelType}-${idx}`"
        class="min-w-full snap-start px-4"
      >
        <ExpensePanel
          v-if="panelType === 'expense'"
          :form-data="formData"
          :accounts="accounts"
          :categories="expenseCategories"
          :split-data="splitData"
          :split-validation-error="splitValidationError"
          :autofocus-amount="autofocusAmount && realPanelIndices.has(idx)"
          @update:form-data="$emit('update:formData', $event)"
          @add-participant="$emit('addParticipant', $event)"
          @remove-participant="$emit('removeParticipant', $event)"
          @update-participant-amount="
            (id, amount) => $emit('updateParticipantAmount', id, amount)
          "
          @update-participant-name="
            (id, name) => $emit('updateParticipantName', id, name)
          "
          @set-split-method="$emit('setSplitMethod', $event)"
          @set-my-share="$emit('setMyShare', $event)"
          @set-split-enabled="$emit('setSplitEnabled', $event)"
        />
        <IncomePanel
          v-else-if="panelType === 'income'"
          :form-data="formData"
          :accounts="accounts"
          :categories="incomeCategories"
          @update:form-data="$emit('update:formData', $event)"
        />
        <TransferPanel
          v-else-if="panelType === 'transfer'"
          :form-data="formData"
          :accounts="accounts"
          :user-currency="userCurrency"
          @update:form-data="$emit('update:formData', $event)"
        />
      </div>
    </div>

    <!-- Description & Date -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <UInput
        :model-value="formData.description"
        label="Комментарий"
        placeholder="Добавьте описание..."
        @update:model-value="
          $emit('update:formData', {
            ...formData,
            description: $event as string,
          })
        "
        @keydown.enter.prevent
      />
      <UInput
        :model-value="new Date(formData.date).toISOString().split('T')[0]"
        label="Дата"
        type="date"
        @update:model-value="
          (v: string | number) => {
            const p = String(v).split('-');
            $emit('update:formData', {
              ...formData,
              date: new Date(+p[0], +p[1] - 1, +p[2]).getTime(),
            });
          }
        "
      />
    </div>

    <!-- Error -->
    <p v-if="error" class="text-xs text-danger">{{ error }}</p>

    <!-- Submit -->
    <UButton
      type="submit"
      variant="primary"
      size="lg"
      full-width
      :loading="isSubmitting"
      :disabled="!isValid"
    >
      {{ submitLabel }}
    </UButton>
  </form>
</template>
