<script setup lang="ts">
import { ConfirmDeleteModal, UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { Debt } from '@/shared/api/database.types';

defineProps<{
  modelValue: boolean;
  debt: Debt | null;
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
    title="Удалить долг"
    warning-text="Долг будет полностью удалён. Связанная транзакция будет удалена, а баланс счёта восстановлен. Это действие нельзя отменить."
    :is-deleting="isDeleting"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <div
      v-if="debt"
      class="flex items-center gap-3 p-4 rounded-xl bg-surface-light dark:bg-surface-dark"
    >
      <div
        class="w-12 h-12 rounded-xl flex items-center justify-center"
        :class="
          debt.debt_type === 'given'
            ? 'bg-debt-given-light'
            : 'bg-debt-received-light'
        "
      >
        <UIcon
          :name="debt.debt_type === 'given' ? 'arrow_upward' : 'arrow_downward'"
          size="md"
          :class="
            debt.debt_type === 'given'
              ? 'text-debt-given'
              : 'text-debt-received'
          "
        />
      </div>
      <div class="flex-1 min-w-0">
        <p
          class="font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
        >
          {{ debt.person_name || debt.name }}
        </p>
        <p
          class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
        >
          {{ formatCurrency(debt.total_amount, currency) }}
        </p>
      </div>
    </div>
  </ConfirmDeleteModal>
</template>
