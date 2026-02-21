<script setup lang="ts">
import type { ToastProviderProps } from 'reka-ui';
import { ToastProvider } from 'reka-ui';

const props = withDefaults(defineProps<ToastProviderProps>(), {
  swipeDirection: 'up',
  duration: 3000,
});
</script>

<template>
  <ToastProvider v-bind="props">
    <slot />
  </ToastProvider>
</template>
