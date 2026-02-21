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
        'fixed bottom-0 left-1/2 -translate-x-1/2 z-[100] flex max-h-screen w-full flex-col-reverse p-4 pb-[calc(env(safe-area-inset-bottom,0px)+100px)] items-center md:max-w-[420px]',
        props.class,
      )
    "
    v-bind="props"
  >
    <slot />
  </ToastViewport>
</template>
