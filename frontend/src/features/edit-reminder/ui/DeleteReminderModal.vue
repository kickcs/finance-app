<script setup lang="ts">
import { ConfirmDeleteModal, UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { Reminder } from '@/shared/api/database.types';

defineProps<{
  modelValue: boolean;
  reminder: Reminder | null;
  currency: string;
  isDeleting?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <ConfirmDeleteModal
    :model-value="modelValue"
    title="Удалить подписку"
    warning-text="Подписка будет полностью удалена. Это действие нельзя отменить."
    :is-deleting="isDeleting"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <div
      v-if="reminder"
      class="flex items-center gap-3 p-4 rounded-xl bg-surface-light dark:bg-surface-dark"
    >
      <div
        class="w-12 h-12 rounded-xl flex items-center justify-center bg-reminder-light"
      >
        <UIcon :name="reminder.icon" size="md" class="text-reminder" />
      </div>
      <div class="flex-1 min-w-0">
        <p
          class="font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
        >
          {{ reminder.name }}
        </p>
        <p
          class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
        >
          {{ formatCurrency(reminder.amount, currency) }}
        </p>
      </div>
    </div>
  </ConfirmDeleteModal>
</template>
