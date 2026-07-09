<script setup lang="ts">
import { computed } from 'vue';
import { UButton, UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';

const props = defineProps<{
  subtotal: number;
  chargesAmount: number;
  totalAmount: number;
  currency: string;
  validationError: string | null;
  disabled: boolean;
}>();

const emit = defineEmits<{
  requestNext: [];
}>();

const hasCharges = computed(() => props.chargesAmount > 0);
</script>

<template>
  <div
    class="absolute bottom-0 inset-x-0 border-t border-border-light/50 dark:border-border-dark/50 px-5 pt-4 pb-[calc(1.25rem+var(--safe-area-inset-bottom))] bg-background-light/85 dark:bg-background-dark/85 backdrop-blur-xl shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.1)] dark:shadow-none"
  >
    <!-- Слот для предупреждений (сверка суммы и т.п.) -->
    <slot name="banner" />

    <!-- Total breakdown -->
    <div class="mb-3">
      <template v-if="hasCharges">
        <div class="flex items-baseline justify-between mb-1">
          <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
            Позиции
          </span>
          <span
            class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark tabular-nums"
          >
            {{ formatCurrency(subtotal, currency) }}
          </span>
        </div>
        <div class="flex items-baseline justify-between mb-2">
          <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
            Сборы
          </span>
          <span
            class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark tabular-nums"
          >
            +{{ formatCurrency(chargesAmount, currency) }}
          </span>
        </div>
        <div class="border-t border-dashed border-border-light dark:border-border-dark mb-2" />
      </template>

      <div class="flex items-baseline justify-between">
        <span class="text-body font-medium text-text-primary-light dark:text-text-primary-dark">
          Итого
        </span>
        <span
          class="text-h3 font-mono font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums tracking-tight transition-all duration-200"
        >
          {{ formatCurrency(totalAmount, currency) }}
        </span>
      </div>
    </div>

    <!-- Validation error -->
    <Transition name="section-slide">
      <p v-if="validationError" class="text-sm text-danger mb-3 flex items-center gap-2">
        <UIcon name="error" size="sm" class="flex-shrink-0" />
        {{ validationError }}
      </p>
    </Transition>

    <UButton
      variant="primary"
      size="lg"
      full-width
      :disabled="disabled"
      aria-label="Перейти к назначению участников"
      @click="emit('requestNext')"
    >
      Далее — Участники
      <UIcon name="arrow_forward" size="sm" class="ml-2" />
    </UButton>
  </div>
</template>

<style>
@import './transitions.css';
</style>
