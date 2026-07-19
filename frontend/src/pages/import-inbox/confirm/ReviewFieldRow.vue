<script setup lang="ts">
import { UIcon } from '@/shared/ui';

withDefaults(
  defineProps<{
    icon: string;
    label: string;
    value?: string | null;
    placeholder?: string;
  }>(),
  { value: null, placeholder: 'Выбрать' },
);
</script>

<template>
  <button
    type="button"
    class="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-surface-light dark:active:bg-surface-dark transition-colors"
  >
    <UIcon
      :name="icon"
      size="sm"
      class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
    />
    <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark shrink-0">
      {{ label }}
    </span>
    <span class="flex-1 min-w-0 text-right">
      <slot>
        <span
          class="text-sm truncate block"
          :class="
            value
              ? 'font-medium text-text-primary-light dark:text-text-primary-dark'
              : 'text-text-tertiary-light dark:text-text-tertiary-dark'
          "
        >
          {{ value || placeholder }}
        </span>
      </slot>
    </span>
    <UIcon
      name="chevron_right"
      size="sm"
      class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
    />
  </button>
</template>
