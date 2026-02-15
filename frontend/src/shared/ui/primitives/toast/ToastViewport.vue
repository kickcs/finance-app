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
        'fixed bottom-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]',
        'safe-area-inset-bottom',
        props.class,
      )
    "
    v-bind="props"
  />
</template>
