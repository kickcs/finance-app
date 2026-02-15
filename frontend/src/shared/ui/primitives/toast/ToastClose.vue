<script setup lang="ts">
import type { ToastCloseProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { ToastClose } from 'reka-ui';
import { Cross2Icon } from '@radix-icons/vue';
import { cn } from '@/shared/lib/utils';

const props = defineProps<
  ToastCloseProps & { class?: HTMLAttributes['class'] }
>();
</script>

<template>
  <ToastClose
    :class="
      cn(
        'absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity',
        'text-text-secondary-light dark:text-text-secondary-dark',
        'hover:text-text-primary-light dark:hover:text-text-primary-dark',
        'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary',
        'group-hover:opacity-100',
        props.class,
      )
    "
    v-bind="props"
  >
    <Cross2Icon class="h-4 w-4" />
  </ToastClose>
</template>
