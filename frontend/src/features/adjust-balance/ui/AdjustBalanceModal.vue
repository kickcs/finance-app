<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UButton, UInput } from '@/shared/ui';
import { formatCurrency, getCurrencySymbol } from '@/shared/lib/format/currency';
import { cn } from '@/shared/lib/utils';
import type { AccountWithBalances } from '@/shared/api/database.types';

const props = defineProps<{
  modelValue: boolean;
  account: AccountWithBalances | null;
  currency: string;
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [
    data: {
      accountId: string;
      targetBalance: number;
      currency: string;
      description: string;
    },
  ];
}>();

const targetBalanceInput = ref('');
const description = ref('');

// Find the balance for the current currency
const currentBalance = computed(() => {
  if (!props.account) return 0;
  const bal = props.account.balances.find((b) => b.currency === props.currency);
  return bal?.balance ?? 0;
});

// Parse input: handle comma/period as decimal or thousands separator
function parseInput(value: string): number | null {
  if (!value.trim()) return null;
  let cleaned = value.replace(/\s/g, '');
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // Both separators: period is thousands, comma is decimal (e.g. "1.234,56")
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Single separator: comma as decimal (e.g. "1234,56") or period (e.g. "1234.56")
    cleaned = cleaned.replace(',', '.');
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

const targetBalance = computed(() => parseInput(targetBalanceInput.value));

const diff = computed(() => {
  if (targetBalance.value === null) return 0;
  return targetBalance.value - currentBalance.value;
});

const hasDiff = computed(() => targetBalance.value !== null && Math.abs(diff.value) > 0.001);

const canSubmit = computed(() => targetBalance.value !== null && hasDiff.value);

const modalTitle = computed(() => {
  const symbol = getCurrencySymbol(props.currency);
  return `Коррекция баланса · ${symbol}`;
});

// Reset form when modal opens
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      targetBalanceInput.value = '';
      description.value = '';
    }
  },
);

function handleConfirm() {
  if (!props.account || targetBalance.value === null) return;
  emit('confirm', {
    accountId: props.account.id,
    targetBalance: targetBalance.value,
    currency: props.currency,
    description: description.value.trim(),
  });
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    :title="modalTitle"
    :closeable="!isLoading"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="account" class="space-y-5">
      <!-- Current balance (read-only) -->
      <div>
        <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Текущий баланс
        </label>
        <div
          class="mt-1.5 px-3 py-2.5 rounded-lg bg-surface-light dark:bg-surface-dark text-sm font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          {{ formatCurrency(currentBalance, currency) }}
        </div>
      </div>

      <!-- Target balance input -->
      <UInput
        v-model="targetBalanceInput"
        label="Реальный баланс"
        placeholder="0"
        inputmode="decimal"
      />

      <!-- Diff display -->
      <div
        v-if="hasDiff"
        :class="
          cn(
            'px-3 py-2.5 rounded-lg text-sm font-semibold',
            diff > 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
          )
        "
      >
        {{ diff > 0 ? '+' : '−' }}{{ formatCurrency(Math.abs(diff), currency) }}
        <span class="font-normal opacity-70">
          {{ diff > 0 ? 'будет добавлено' : 'будет списано' }}
        </span>
      </div>

      <!-- Description -->
      <UInput
        v-model="description"
        label="Описание (необязательно)"
        placeholder="Причина коррекции..."
      />
    </div>

    <template #actions>
      <UButton
        variant="secondary"
        full-width
        :disabled="isLoading"
        @click="emit('update:modelValue', false)"
      >
        Отмена
      </UButton>
      <UButton
        variant="primary"
        full-width
        :disabled="!canSubmit"
        :loading="isLoading"
        @click="handleConfirm"
      >
        Скорректировать
      </UButton>
    </template>
  </UModal>
</template>
