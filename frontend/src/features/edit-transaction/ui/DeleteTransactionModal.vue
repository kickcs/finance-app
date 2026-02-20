<script setup lang="ts">
import { computed } from 'vue';
import { ConfirmDeleteModal, UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { getCategoryById } from '@/entities/category';
import type { Transaction } from '@/shared/api/database.types';

const props = defineProps<{
  modelValue: boolean;
  transaction: Transaction | null;
  currency: string;
  isDeleting?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
  cancel: [];
}>();

const category = computed(() => {
  if (!props.transaction) return null;
  return getCategoryById(props.transaction.category_id);
});

const formattedAmount = computed(() => {
  if (!props.transaction) return '';
  const prefix = props.transaction.type === 'income' ? '+' : '-';
  return `${prefix}${formatCurrency(props.transaction.amount, props.currency)}`;
});

const warningText = computed(() => {
  if (!props.transaction) return '';
  const direction =
    props.transaction.type === 'income' ? 'уменьшен' : 'увеличен';
  return `Баланс будет ${direction} на ${formatCurrency(props.transaction.amount, props.currency)}`;
});
</script>

<template>
  <ConfirmDeleteModal
    :model-value="modelValue"
    title="Удалить"
    :warning-text="warningText"
    :is-deleting="isDeleting"
    compact
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <div
      v-if="transaction"
      class="flex items-center gap-2.5 p-3 rounded-lg bg-surface-light dark:bg-surface-dark"
    >
      <div
        class="w-10 h-10 rounded-lg flex items-center justify-center"
        :style="{ backgroundColor: `${category?.color || '#64748b'}15` }"
      >
        <UIcon
          :name="category?.icon || 'receipt_long'"
          size="sm"
          :style="{ color: category?.color || '#64748b' }"
        />
      </div>
      <div class="flex-1 min-w-0">
        <p
          class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
        >
          {{ category?.name || 'Транзакция' }}
        </p>
        <p
          class="text-sm font-medium"
          :class="
            transaction.type === 'income'
              ? 'text-success'
              : 'text-text-secondary-light dark:text-text-secondary-dark'
          "
        >
          {{ formattedAmount }}
        </p>
      </div>
    </div>
  </ConfirmDeleteModal>
</template>
