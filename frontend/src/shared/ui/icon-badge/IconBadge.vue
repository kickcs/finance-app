<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui/icon';
import { cn } from '@/shared/lib/utils';

interface Props {
  icon: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
  bgClass?: string;
  iconClass?: string;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
});

const sizeClasses = {
  xs: 'w-6 h-6 rounded-md',
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-9 h-9 rounded-lg',
  lg: 'w-10 h-10 rounded-xl',
} as const;

const iconSizes = {
  xs: 'xs',
  sm: 'sm',
  md: 'sm',
  lg: 'md',
} as const;

const containerClass = computed(() =>
  cn(
    sizeClasses[props.size],
    'flex items-center justify-center shrink-0',
    props.bgClass,
    props.class,
  ),
);

const containerStyle = computed(() => {
  if (props.color) {
    return { backgroundColor: props.color + '15' };
  }
  return undefined;
});

const computedIconClass = computed(() => {
  if (props.iconClass) return props.iconClass;
  if (props.color) return undefined;
  return 'text-text-tertiary-light dark:text-text-tertiary-dark';
});

const computedIconStyle = computed(() => {
  if (props.color && !props.iconClass) {
    return { color: props.color };
  }
  return undefined;
});
</script>

<template>
  <div :class="containerClass" :style="containerStyle">
    <UIcon
      :name="icon"
      :size="iconSizes[size]"
      :class="computedIconClass"
      :style="computedIconStyle"
    />
  </div>
</template>
