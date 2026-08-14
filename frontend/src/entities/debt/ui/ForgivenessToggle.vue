<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';

defineProps<{
  modelValue: boolean;
  remainderAmount: number;
  currency: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <button
    type="button"
    class="flex items-center gap-3 w-full p-3 rounded-xl transition-colors"
    :class="
      modelValue
        ? 'bg-primary/5 border border-primary/20'
        : 'bg-surface-light dark:bg-surface-dark border border-transparent'
    "
    @click="emit('update:modelValue', !modelValue)"
  >
    <!-- Невыбранная рамка не может быть `border-*`: в тёмной теме это ровно тот
         же цвет, что и фон строки, а в светлой контраст 1.05:1 — пустого
         чекбокса не было видно вовсе. Нужна и своя заливка, и заметная рамка. -->
    <div
      class="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0"
      :class="
        modelValue
          ? 'bg-primary border-primary'
          : 'bg-card-light dark:bg-card-dark border-text-tertiary-light dark:border-text-tertiary-dark'
      "
    >
      <UIcon v-if="modelValue" name="check" size="xs" class="text-white" />
    </div>
    <div class="flex-1 text-left">
      <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        Простить остаток
      </p>
      <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
        {{ formatCurrency(remainderAmount, currency) }} будет списано как подарок
      </p>
    </div>
    <UIcon
      name="volunteer_activism"
      size="sm"
      class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
    />
  </button>
</template>
