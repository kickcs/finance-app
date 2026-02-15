<script setup lang="ts">
import { UModal, UButton, UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { Debt } from '@/shared/api/database.types';

defineProps<{
  modelValue: boolean;
  debt: Debt | null;
  currency: string;
  isClosing?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
  cancel: [];
}>();

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}

function confirm() {
  emit('confirm');
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    title="Закрыть долг"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="debt" class="space-y-4">
      <!-- Debt Info Card -->
      <div
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
            :name="
              debt.debt_type === 'given' ? 'arrow_upward' : 'arrow_downward'
            "
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
            {{ debt.debt_type === 'given' ? 'Вам должны' : 'Вы должны' }}
          </p>
        </div>
        <p
          class="text-lg font-bold text-text-primary-light dark:text-text-primary-dark"
        >
          {{ formatCurrency(debt.remaining_amount, currency) }}
        </p>
      </div>

      <!-- Info Message -->
      <div class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
        <div class="flex items-start gap-3">
          <UIcon
            name="info"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5"
          />
          <p
            class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
          >
            {{
              debt.debt_type === 'given'
                ? 'Сумма будет возвращена на ваш счёт. Долг будет отмечен как погашенный.'
                : 'Сумма будет списана с вашего счёта. Долг будет отмечен как погашенный.'
            }}
          </p>
        </div>
      </div>
    </div>

    <template #actions>
      <UButton variant="secondary" full-width @click="close"> Отмена </UButton>
      <UButton
        variant="primary"
        full-width
        :loading="isClosing"
        @click="confirm"
      >
        Закрыть долг
      </UButton>
    </template>
  </UModal>
</template>
