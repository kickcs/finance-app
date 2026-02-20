<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, ConfirmDeleteModal } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { Account, AccountWithBalances } from '@/shared/api/database.types';

const props = defineProps<{
  modelValue: boolean;
  account: Account | AccountWithBalances | null;
  transactionsCount: number;
  isLoadingCount?: boolean;
  currency: string;
  isDeleting?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
  cancel: [];
}>();

const formattedBalances = computed(() => {
  if (!props.account) return '';
  const acc = props.account;
  // Check if it's AccountWithBalances (has balances array)
  if ('balances' in acc && Array.isArray(acc.balances)) {
    return (acc as AccountWithBalances).balances
      .map((b) => formatCurrency(b.balance, b.currency))
      .join(' · ');
  }
  // Legacy Account with single balance
  return formatCurrency((acc as Account).balance, props.currency);
});

const warningText = computed(() => {
  const parts = ['Счёт будет полностью удалён.'];
  if (props.isLoadingCount) {
    parts.push('Подсчёт транзакций...');
  } else if (props.transactionsCount > 0) {
    const n = props.transactionsCount;
    const word =
      n === 1
        ? 'транзакция будет удалена'
        : n < 5
          ? 'транзакции будут удалены'
          : 'транзакций будут удалены';
    parts.push(`${n} ${word}.`);
  }
  parts.push('Это действие нельзя отменить.');
  return parts.join(' ');
});
</script>

<template>
  <ConfirmDeleteModal
    :model-value="modelValue"
    title="Удалить счёт"
    :warning-text="warningText"
    :is-deleting="isDeleting"
    :error="error"
    :disabled="!!error"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <div
      v-if="account"
      class="flex items-center gap-3 p-4 rounded-xl bg-surface-light dark:bg-surface-dark"
    >
      <div
        class="w-12 h-12 rounded-xl flex items-center justify-center"
        :style="{ backgroundColor: `${account.color}20` }"
      >
        <UIcon
          :name="account.icon"
          size="md"
          :style="{ color: account.color }"
        />
      </div>
      <div class="flex-1 min-w-0">
        <p
          class="font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
        >
          {{ account.name }}
        </p>
        <p
          class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
        >
          {{ formattedBalances }}
        </p>
      </div>
    </div>
  </ConfirmDeleteModal>
</template>
