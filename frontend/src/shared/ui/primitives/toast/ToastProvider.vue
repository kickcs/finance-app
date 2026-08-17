<script setup lang="ts">
import type { ToastProviderProps } from 'reka-ui';
import { computed } from 'vue';
import { ToastProvider } from 'reka-ui';
import { TOAST_DURATION } from '@/shared/lib/composables/useToast';
import { useToastPosition } from './useToastPosition';

const props = withDefaults(defineProps<ToastProviderProps>(), { duration: TOAST_DURATION });

const position = useToastPosition();

// Свайп уводит тост к ближайшему краю: вверх у верхних, вниз у нижних. Раньше
// направление было жёстко «вверх», и нижние тосты приходилось смахивать внутрь экрана.
const forwarded = computed(() => ({
  ...props,
  swipeDirection: props.swipeDirection ?? (position.value === 'top' ? 'up' : 'down'),
}));
</script>

<template>
  <ToastProvider v-bind="forwarded">
    <slot />
  </ToastProvider>
</template>
