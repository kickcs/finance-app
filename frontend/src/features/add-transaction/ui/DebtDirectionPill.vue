<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import type { DebtDirection } from '@/entities/debt';

defineProps<{
  modelValue: DebtDirection;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: DebtDirection];
}>();

const { trigger } = useHaptics();

function select(value: DebtDirection) {
  trigger('selection');
  emit('update:modelValue', value);
}
</script>

<template>
  <div class="flex justify-center">
    <div
      class="inline-flex items-center p-1 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark"
      role="tablist"
      aria-label="Направление долга"
    >
      <button
        type="button"
        role="tab"
        :aria-selected="modelValue === 'given'"
        class="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
        :class="
          modelValue === 'given'
            ? 'bg-card-light dark:bg-card-dark text-text-primary-light dark:text-text-primary-dark shadow-sm'
            : 'text-text-secondary-light dark:text-text-secondary-dark'
        "
        @click="select('given')"
      >
        <UIcon name="arrow_upward" size="xs" />
        <span>Дал</span>
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="modelValue === 'taken'"
        class="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
        :class="
          modelValue === 'taken'
            ? 'bg-card-light dark:bg-card-dark text-text-primary-light dark:text-text-primary-dark shadow-sm'
            : 'text-text-secondary-light dark:text-text-secondary-dark'
        "
        @click="select('taken')"
      >
        <UIcon name="arrow_downward" size="xs" />
        <span>Взял</span>
      </button>
    </div>
  </div>
</template>
