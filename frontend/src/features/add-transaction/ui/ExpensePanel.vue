<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue';
import { UIcon, InitialAvatar } from '@/shared/ui';
import type { Category } from '@/entities/category';
import type { SplitExpenseData, SplitMethod } from '@/features/split-expense';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  categories: Category[];
  splitData?: SplitExpenseData;
  splitValidationError?: string | null;
  autofocusAmount?: boolean;
}>();
const emit = defineEmits<{
  'update:formData': [value: TransactionFormData];
  addParticipant: [name: string, fromContacts: boolean, personColor?: string];
  removeParticipant: [id: string];
  updateParticipantAmount: [id: string, amount: number];
  setSplitMethod: [method: SplitMethod];
  setMyShare: [amount: number];
  setIsIncluded: [included: boolean];
  setSplitEnabled: [enabled: boolean];
}>();
const SplitExpenseDrawer = defineAsyncComponent(
  () => import('@/features/split-expense/ui/SplitExpenseDrawer.vue'),
);
import type { AccountWithBalances } from '@/entities/account';
import type { TransactionFormData } from '../model/useTransactionForm';
import { usePanelState } from '../model/usePanelState';
import HeroAmount from './HeroAmount.vue';
import { CategoryChips } from '@/entities/category';
import { AccountSelector } from '@/entities/account';

const {
  availableCurrencies,
  isMultiCurrency,
  currencySymbol,
  currentBalance,
  hasSufficientFunds,
  updateField,
  handleAccountChange,
} = usePanelState(props, emit);

const drawerOpen = ref(false);

const hasSplit = computed(() => {
  return props.splitData?.enabled && props.splitData.participants.length > 0;
});

const splitSummary = computed(() => {
  if (!props.splitData || !hasSplit.value) return '';
  const names = props.splitData.participants.map((p) => p.personName);
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
});

function clearSplit() {
  emit('setSplitEnabled', false);
}
</script>

<template>
  <div class="space-y-2">
    <HeroAmount
      :amount="formData.amount"
      :currency="formData.currency"
      :currency-symbol="currencySymbol"
      :available-currencies="availableCurrencies"
      :is-multi-currency="isMultiCurrency"
      :show-insufficient-funds="!hasSufficientFunds"
      :current-balance="currentBalance"
      :autofocus="autofocusAmount"
      @update:amount="updateField('amount', $event)"
      @update:currency="updateField('currency', $event)"
    />

    <AccountSelector
      :accounts="accounts"
      :selected-id="formData.accountId"
      label="Счёт"
      @select="handleAccountChange"
    />

    <CategoryChips
      :categories="categories"
      :selected-id="formData.categoryId"
      :rows="4"
      label="Категория"
      @select="updateField('categoryId', $event)"
    />

    <!-- Split button / summary -->
    <div v-if="splitData">
      <!-- Configured split summary -->
      <div
        v-if="hasSplit"
        role="button"
        tabindex="0"
        class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/20 bg-primary/[0.04] dark:bg-primary/[0.08] transition-all hover:border-primary/30 active:scale-[0.99] cursor-pointer"
        @click="drawerOpen = true"
        @keydown.enter="drawerOpen = true"
      >
        <div class="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <UIcon name="group" size="sm" class="text-primary" />
        </div>
        <div class="flex-1 min-w-0 text-left">
          <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            Разделено на {{ splitData!.participants.length + (splitData!.isIncluded ? 1 : 0) }}
          </p>
          <div class="flex items-center gap-1 mt-0.5">
            <div class="flex -space-x-1.5">
              <InitialAvatar
                v-for="p in splitData!.participants.slice(0, 3)"
                :key="p.id"
                :name="p.personName"
                :color="p.personColor || '#3b82f6'"
                size="xs"
                class="ring-1 ring-card-light dark:ring-card-dark"
              />
            </div>
            <span
              class="text-xs text-text-secondary-light dark:text-text-secondary-dark ml-1 truncate"
            >
              {{ splitSummary }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <UIcon name="edit" size="xs" class="text-primary" />
          <button
            type="button"
            class="p-1 text-text-tertiary-light dark:text-text-tertiary-dark hover:text-danger transition-colors"
            @click.stop="clearSplit"
          >
            <UIcon name="close" size="xs" />
          </button>
        </div>
      </div>

      <!-- Empty state: split button -->
      <button
        v-else
        type="button"
        class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border-light dark:border-border-dark hover:border-primary hover:bg-primary/[0.03] dark:hover:bg-primary/[0.06] transition-all active:scale-[0.99]"
        @click="drawerOpen = true"
      >
        <div
          class="w-9 h-9 rounded-full bg-surface-light dark:bg-surface-dark flex items-center justify-center shrink-0"
        >
          <UIcon
            name="group"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </div>
        <div class="flex-1 text-left">
          <p class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
            Разделить расход
          </p>
        </div>
        <UIcon
          name="chevron_right"
          size="sm"
          class="text-text-tertiary-light dark:text-text-tertiary-dark"
        />
      </button>

      <!-- Drawer -->
      <SplitExpenseDrawer
        :open="drawerOpen"
        :total-amount="formData.amount"
        :currency="formData.currency"
        :split-data="splitData"
        :validation-error="splitValidationError"
        @update:open="drawerOpen = $event"
        @add-participant="
          (name: string, fromContacts: boolean, color?: string) =>
            $emit('addParticipant', name, fromContacts, color)
        "
        @remove-participant="$emit('removeParticipant', $event)"
        @update-participant-amount="(id, amount) => $emit('updateParticipantAmount', id, amount)"
        @set-method="$emit('setSplitMethod', $event)"
        @set-my-share="$emit('setMyShare', $event)"
        @set-is-included="$emit('setIsIncluded', $event)"
        @set-enabled="$emit('setSplitEnabled', $event)"
      />
    </div>
  </div>
</template>
