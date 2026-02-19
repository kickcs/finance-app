<script setup lang="ts">
import { computed } from 'vue';
import { ProgressIndicator, ProgressRoot } from 'reka-ui';
import { cn } from '@/shared/lib/utils';

export interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  ariaLabel?: string;
}

const props = withDefaults(defineProps<ProgressBarProps>(), {
  max: 100,
  color: 'primary',
  size: 'md',
  showLabel: false,
});

const percentage = computed(() => {
  if (!props.max || props.max <= 0) return 0;
  return Math.min(100, Math.max(0, (props.value / props.max) * 100));
});

const sizeClasses = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-2.5',
};

const indicatorStyle = computed(() => {
  if (props.color.startsWith('#')) {
    return {
      transform: `translateX(-${100 - percentage.value}%)`,
      backgroundColor: props.color,
    };
  }

  return {
    transform: `translateX(-${100 - percentage.value}%)`,
  };
});

const colorClass = computed(() => {
  if (props.color.startsWith('#')) return '';

  const colorMap: Record<string, string> = {
    primary: 'bg-primary',
    success: 'bg-success',
    danger: 'bg-danger',
    warning: 'bg-warning',
  };

  return colorMap[props.color] || 'bg-primary';
});
</script>

<template>
  <div class="w-full">
    <div v-if="showLabel" class="flex justify-between items-center mb-1.5">
      <slot name="label" />
      <span
        class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
      >
        {{ Math.round(percentage) }}%
      </span>
    </div>

    <ProgressRoot
      :model-value="percentage"
      :class="
        cn(
          'relative w-full overflow-hidden rounded-full bg-surface-light dark:bg-surface-dark',
          sizeClasses[size],
        )
      "
      :aria-label="ariaLabel || `Progress: ${Math.round(percentage)}%`"
    >
      <ProgressIndicator
        :class="
          cn(
            'h-full w-full flex-1 rounded-full transition-transform duration-200 ease-out',
            colorClass,
          )
        "
        :style="indicatorStyle"
      />
    </ProgressRoot>
  </div>
</template>
