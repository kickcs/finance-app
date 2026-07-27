<script setup lang="ts">
import { formatNumberWithSpaces } from '@/shared/lib/format/currency';
import { useHaptics } from '@/shared/lib/haptics';

defineProps<{
  /** Частые суммы пользователя. Пустой список — блок не рисуется вовсе. */
  amounts: number[];
  currentAmount: number;
}>();

const emit = defineEmits<{ select: [amount: number] }>();

const { trigger } = useHaptics();

function select(amount: number) {
  trigger('selection');
  emit('select', amount);
}
</script>

<template>
  <Transition name="suggestions">
    <div v-if="amounts.length" class="flex justify-center gap-1.5 overflow-x-auto no-scrollbar">
      <button
        v-for="amount in amounts"
        :key="amount"
        type="button"
        class="suggestion-chip shrink-0 rounded-full px-3 py-1.5 text-sm font-medium tabular-nums border transition-[color,background-color,border-color,transform] duration-200 active:scale-95"
        :class="
          amount === currentAmount
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
        "
        @mousedown.prevent
        @click="select(amount)"
      >
        {{ formatNumberWithSpaces(String(amount)) }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.suggestions-enter-active,
.suggestions-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.suggestions-enter-from,
.suggestions-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .suggestions-enter-active,
  .suggestions-leave-active,
  .suggestion-chip {
    transition: none;
  }
}
</style>
