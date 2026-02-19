<script setup lang="ts">
import { computed, ref } from 'vue';
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
import { useHashtags } from '@/entities/transaction';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
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

// Hashtag suggestions
const { userId } = useCurrentUser();
const { hashtags } = useHashtags(userId);
const descriptionFocused = ref(false);

function insertHashtag(tag: string) {
  const current = props.formData.description || '';
  const separator = current && !current.endsWith(' ') ? ' ' : '';
  emit('update:formData', {
    ...props.formData,
    description: current + separator + tag,
  });
}
</script>

<template>
  <form
    class="flex-1 flex flex-col gap-3 transition-opacity duration-200 overflow-hidden"
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

    <!-- Bottom section -->
    <div class="mt-auto space-y-3">
      <!-- Description & Date -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          class="space-y-2"
          @focusin="descriptionFocused = true"
          @focusout="descriptionFocused = false"
        >
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

          <!-- Hashtag suggestions -->
          <Transition name="hashtags">
            <div
              v-if="descriptionFocused && hashtags.length > 0"
              class="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5"
            >
              <button
                v-for="h in hashtags"
                :key="h.tag"
                type="button"
                class="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium
                  bg-surface-light dark:bg-surface-dark
                  text-text-secondary-light dark:text-text-secondary-dark
                  hover:bg-primary-light hover:text-primary
                  active:scale-95
                  transition-all duration-150"
                @mousedown.prevent="insertHashtag(h.tag)"
              >
                {{ h.tag }}
              </button>
            </div>
          </Transition>
        </div>
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
    </div>
  </form>
</template>

<style scoped>
.hashtags-enter-active,
.hashtags-leave-active {
  transition: all 0.15s ease;
}
.hashtags-enter-from,
.hashtags-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
