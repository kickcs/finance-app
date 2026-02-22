<script setup lang="ts">
import { computed } from 'vue';
import { iconMap } from './iconMap';

export interface IconProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  filled?: boolean;
  color?: string;
  ariaLabel?: string;
}

const props = withDefaults(defineProps<IconProps>(), {
  size: 'md',
  filled: false,
});

const sizeMap: Record<string, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
};

const iconComponent = computed(() => iconMap[props.name]);
const pixelSize = computed(() => sizeMap[props.size]);
</script>

<template>
  <component
    :is="iconComponent"
    v-if="iconComponent"
    :size="pixelSize"
    :stroke-width="filled ? 2.5 : 2"
    :class="['inline-flex shrink-0', color]"
    :aria-hidden="!ariaLabel"
    :aria-label="ariaLabel"
    :role="ariaLabel ? 'img' : undefined"
  />
  <span
    v-else
    :class="['inline-flex items-center justify-center select-none', color]"
    :style="{
      width: `${pixelSize}px`,
      height: `${pixelSize}px`,
      fontSize: `${pixelSize}px`,
      lineHeight: 1,
    }"
    :aria-hidden="!ariaLabel"
    :aria-label="ariaLabel"
    :role="ariaLabel ? 'img' : undefined"
  >
    ?
  </span>
</template>
