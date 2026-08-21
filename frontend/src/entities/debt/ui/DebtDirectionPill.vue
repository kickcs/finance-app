<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import type { DebtDirection } from '../model/types';

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
  <!-- Центрованная пилюля в ~160 px терялась: направление долга — первое
       решение на вкладке, а выглядело мельче всего на экране. -->
  <div
    class="grid grid-cols-2 gap-1 rounded-xl border border-border-light bg-surface-light p-1 dark:border-border-dark dark:bg-surface-dark"
    role="tablist"
    aria-label="Направление долга"
  >
    <button
      type="button"
      role="tab"
      :aria-selected="modelValue === 'given'"
      class="direction-tab flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold"
      :class="
        modelValue === 'given'
          ? 'bg-card-light text-text-primary-light shadow-sm dark:bg-card-dark dark:text-text-primary-dark'
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
      class="direction-tab flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold"
      :class="
        modelValue === 'taken'
          ? 'bg-card-light text-text-primary-light shadow-sm dark:bg-card-dark dark:text-text-primary-dark'
          : 'text-text-secondary-light dark:text-text-secondary-dark'
      "
      @click="select('taken')"
    >
      <UIcon name="arrow_downward" size="xs" />
      <span>Взял</span>
    </button>
  </div>
</template>

<style scoped>
.direction-tab {
  transition:
    background-color 200ms ease,
    color 200ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .direction-tab {
    transition: none;
  }
}
</style>
