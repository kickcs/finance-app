<script setup lang="ts">
import { cn } from '@/shared/lib/utils';
import { UIcon } from '../icon';

/** Отметка выбора. Круглая — строка ленты или взаимоисключающий пункт, квадратная — мультивыбор. */
withDefaults(defineProps<{ checked: boolean; shape?: 'round' | 'square' }>(), {
  shape: 'round',
});
</script>

<template>
  <!-- Состояние объявляет сама строка (role="checkbox"/"radio"), отметка — только картинка -->
  <span
    aria-hidden="true"
    :class="
      cn(
        'flex size-5.5 shrink-0 items-center justify-center border-2 text-text-primary-dark transition-colors duration-150',
        shape === 'round' ? 'rounded-full' : 'rounded-md',
        checked
          ? 'border-primary bg-primary'
          : 'border-text-tertiary-light/50 dark:border-text-tertiary-dark/60',
      )
    "
  >
    <UIcon v-if="checked" name="check" size="xs" />
  </span>
</template>
