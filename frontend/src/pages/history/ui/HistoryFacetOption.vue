<script setup lang="ts">
import { IconBadge, UCheckMark } from '@/shared/ui';

/**
 * Строка выбора в шторке чипа. Квадратная отметка — мультивыбор (категории, теги,
 * счета), круглая — взаимоисключающий выбор (период).
 */
defineProps<{
  label: string;
  selected: boolean;
  shape: 'square' | 'round';
  /** Сколько раз значение встречается, например у тега. */
  count?: number;
  /** Иконка категории; цвет — её, он же у точки счёта. */
  icon?: string;
  color?: string;
}>();
</script>

<template>
  <button
    type="button"
    :role="shape === 'round' ? 'radio' : 'checkbox'"
    :aria-checked="selected"
    class="flex min-h-[48px] w-full items-center gap-3 border-b border-border-light py-2 text-left last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-border-dark"
  >
    <IconBadge v-if="icon" :icon="icon" :color="color" size="sm" />
    <span
      v-else-if="color"
      class="ml-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
      :style="{ backgroundColor: color }"
    />
    <span
      class="min-w-0 flex-1 truncate text-body font-medium text-text-primary-light dark:text-text-primary-dark"
    >
      {{ label }}
    </span>
    <span
      v-if="count !== undefined"
      class="shrink-0 text-body-sm tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      {{ count }}
    </span>
    <UCheckMark class="mr-1" :checked="selected" :shape="shape" />
  </button>
</template>
