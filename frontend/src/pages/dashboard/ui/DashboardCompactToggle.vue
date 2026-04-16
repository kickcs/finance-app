<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import { useDashboardContext } from '../model/dashboardContext';

withDefaults(
  defineProps<{
    /** 'icon' = square icon-only button (desktop side panel), 'inline' = text+icon button. */
    variant?: 'icon' | 'inline';
  }>(),
  { variant: 'inline' },
);

const { isCompactMode, toggleCompactMode } = useDashboardContext();
</script>

<template>
  <button
    v-if="variant === 'icon'"
    type="button"
    :aria-label="isCompactMode ? 'Стандартный режим' : 'Компактный режим'"
    :aria-pressed="isCompactMode"
    class="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
    :class="{ 'text-primary bg-primary/10 hover:bg-primary/15': isCompactMode }"
    @click="toggleCompactMode"
  >
    <UIcon :name="isCompactMode ? 'view_agenda' : 'density_small'" size="sm" />
  </button>

  <button
    v-else
    type="button"
    :aria-label="isCompactMode ? 'Стандартный режим' : 'Компактный режим'"
    :aria-pressed="isCompactMode"
    class="flex items-center gap-1.5 text-body-sm font-medium px-3 py-1.5 rounded-xl transition-colors"
    :class="
      isCompactMode
        ? 'text-primary bg-primary/10 hover:bg-primary/15'
        : 'text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark'
    "
    @click="toggleCompactMode"
  >
    <UIcon :name="isCompactMode ? 'view_agenda' : 'density_small'" size="sm" />
    <span>{{ isCompactMode ? 'Стандартный режим' : 'Компактный режим' }}</span>
  </button>
</template>
