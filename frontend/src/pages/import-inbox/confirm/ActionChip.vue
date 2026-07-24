<script setup lang="ts">
import { UIcon } from '@/shared/ui';

/**
 * Чип компакт-действия на странице подтверждения импорта. В активном состоянии
 * (режим включён) подсвечивается primary и показывает крестик сброса.
 */
defineProps<{
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  /** aria-label крестика сброса; без него крестик не рендерится */
  resetLabel?: string;
}>();

const emit = defineEmits<{
  click: [];
  reset: [];
}>();
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border active:scale-95 transition-all whitespace-nowrap"
    :class="
      active
        ? 'border-primary/30 bg-primary-light text-primary font-medium'
        : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark'
    "
    @click="emit('click')"
  >
    <UIcon :name="icon" size="sm" />
    {{ label }}
    <span
      v-if="active && resetLabel"
      role="button"
      :aria-label="resetLabel"
      class="-mr-1 p-0.5 rounded hover:bg-surface-light dark:hover:bg-surface-dark"
      @click.stop="emit('reset')"
    >
      <UIcon name="close" size="xs" />
    </span>
  </button>
</template>
