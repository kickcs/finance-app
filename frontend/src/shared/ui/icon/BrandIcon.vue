<script setup lang="ts">
import { computed } from 'vue';
import { BRAND_ICON_PATHS } from './brandIconPaths';

const props = withDefaults(
  defineProps<{
    name: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  }>(),
  {
    size: 'md',
  },
);

const SIZE_MAP: Record<string, number> = { xs: 14, sm: 18, md: 22, lg: 28, xl: 32, '2xl': 36 };
const sizePx = computed(() => SIZE_MAP[props.size] ?? 22);

const path = computed(() => BRAND_ICON_PATHS[props.name]);
</script>

<template>
  <svg
    v-if="path"
    :width="sizePx"
    :height="sizePx"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path :d="path" />
  </svg>
</template>
