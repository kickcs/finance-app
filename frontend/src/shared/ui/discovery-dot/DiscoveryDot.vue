<script setup lang="ts">
withDefaults(
  defineProps<{
    show?: boolean;
    size?: 'sm' | 'md';
  }>(),
  { show: true, size: 'sm' },
);
</script>

<template>
  <span v-if="show" aria-hidden="true" class="absolute -top-0.5 -right-0.5 pointer-events-none">
    <span :class="[size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2', 'block rounded-full bg-primary']" />
    <span
      :class="[
        size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2',
        'absolute inset-0 rounded-full bg-primary animate-ping',
      ]"
      style="animation-duration: 2s"
    />
  </span>
</template>
