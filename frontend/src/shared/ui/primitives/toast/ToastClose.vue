<script setup lang="ts">
import type { ToastCloseProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { ToastClose } from 'reka-ui';
import { Cross2Icon } from '@radix-icons/vue';
import { cn } from '@/shared/lib/utils';

const props = defineProps<ToastCloseProps & { class?: HTMLAttributes['class'] }>();
</script>

<template>
  <ToastClose
    :class="
      cn(
        'flex-shrink-0 rounded-full p-1 opacity-0 transition-opacity',
        'text-text-tertiary-light dark:text-text-tertiary-dark',
        'hover:text-text-primary-light dark:hover:text-text-primary-dark',
        'focus:opacity-100 focus:outline-none',
        'group-hover:opacity-100',
        props.class,
      )
    "
    v-bind="props"
  >
    <Cross2Icon class="h-3.5 w-3.5" />
  </ToastClose>
</template>
