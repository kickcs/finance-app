<script setup lang="ts">
import { getInitial } from '@/shared/lib/format/text';

withDefaults(
  defineProps<{
    name: string;
    color: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    /** Use translucent background with colored text instead of solid bg + white text */
    translucent?: boolean;
  }>(),
  {
    size: 'md',
    translucent: false,
  },
);

const sizeClasses: Record<string, string> = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};
</script>

<template>
  <div
    class="rounded-full flex items-center justify-center font-bold shrink-0"
    :class="[sizeClasses[size], translucent ? '' : 'text-white']"
    :style="{
      backgroundColor: translucent ? color + '18' : color,
      color: translucent ? color : undefined,
    }"
  >
    {{ getInitial(name) }}
  </div>
</template>
