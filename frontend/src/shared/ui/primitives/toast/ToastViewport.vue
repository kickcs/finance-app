<script setup lang="ts">
import type { ToastViewportProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { ToastViewport } from 'reka-ui';
import { cn } from '@/shared/lib/utils';

const props = defineProps<
  ToastViewportProps & { class?: HTMLAttributes['class'] }
>();
</script>

<template>
  <ToastViewport
    :class="
      cn(
        'fixed top-0 left-1/2 -translate-x-1/2 z-[100] flex max-h-screen w-full flex-col p-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] items-center md:max-w-[420px]',
        props.class,
      )
    "
    v-bind="props"
  >
    <slot />
  </ToastViewport>
</template>
