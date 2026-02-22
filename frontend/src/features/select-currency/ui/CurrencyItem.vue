<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import type { Currency } from '@/entities/currency';

defineProps<{
  currency: Currency;
  selected?: boolean;
}>();

defineEmits<{
  select: [];
}>();
</script>

<template>
  <button
    :class="[
      'w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200',
      'hover:bg-surface-light dark:hover:bg-surface-dark',
      'active:scale-[0.99]',
      selected && 'ring-2 ring-primary bg-primary/5',
    ]"
    @click="$emit('select')"
  >
    <!-- Flag -->
    <span class="text-2xl">{{ currency.flag }}</span>

    <!-- Content -->
    <div class="flex-1 text-left">
      <p class="font-semibold text-text-primary-light dark:text-text-primary-dark">
        {{ currency.code }}
      </p>
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        {{ currency.name }}
      </p>
    </div>

    <!-- Symbol -->
    <span class="text-text-tertiary-light dark:text-text-tertiary-dark font-medium">
      {{ currency.symbol }}
    </span>

    <!-- Check mark -->
    <div v-if="selected" class="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
      <UIcon name="check" size="sm" class="text-white" />
    </div>
  </button>
</template>
