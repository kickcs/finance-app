<script setup lang="ts">
import type { ToastViewportProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';
import { ToastViewport } from 'reka-ui';
import { cn } from '@/shared/lib/utils';
import type { ToastPosition } from './useToastPosition';

const props = withDefaults(
  defineProps<ToastViewportProps & { class?: HTMLAttributes['class']; position?: ToastPosition }>(),
  { position: 'bottom' },
);

const delegatedProps = computed(() => {
  const { class: _, position: __, ...rest } = props;
  return rest;
});

// bottom: стек растёт вверх от нижнего края (col-reverse), отступ под BottomNav.
// top: стек растёт вниз от верхнего края, отступ под safe-area (шапка Telegram).
const positionClasses = computed(() =>
  props.position === 'top'
    ? 'top-0 flex-col pt-[calc(env(safe-area-inset-top,0px)+16px)]'
    : 'bottom-0 flex-col-reverse pb-[calc(env(safe-area-inset-bottom,0px)+88px)]',
);
</script>

<template>
  <ToastViewport
    :class="
      cn(
        'fixed left-1/2 -translate-x-1/2 z-[100] flex max-h-screen w-full p-4 items-center pointer-events-none md:max-w-[420px]',
        positionClasses,
        props.class,
      )
    "
    v-bind="delegatedProps"
  >
    <slot />
  </ToastViewport>
</template>
