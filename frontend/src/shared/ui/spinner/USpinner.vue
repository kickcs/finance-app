<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg';
  }>(),
  { size: 'md' },
);

const sizeClasses = {
  sm: 'w-5 h-5 border-[1.5px]',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-[3px]',
} as const;
</script>

<template>
  <div
    :class="[
      sizeClasses[size],
      'border-primary border-t-transparent rounded-full animate-spin',
    ]"
    role="status"
    aria-label="Загрузка"
  />
</template>
