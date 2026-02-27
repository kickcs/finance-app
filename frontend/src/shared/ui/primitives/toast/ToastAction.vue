<script setup lang="ts">
import type { ToastActionProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { ToastAction } from 'reka-ui';
import { cn } from '@/shared/lib/utils';

const props = defineProps<ToastActionProps & { class?: HTMLAttributes['class'] }>();
</script>

<template>
  <ToastAction
    :class="
      cn(
        'inline-flex h-7 shrink-0 items-center justify-center rounded-lg border px-2.5',
        'border-border-light dark:border-border-dark',
        'bg-transparent text-xs font-medium',
        'ring-offset-background transition-colors',
        'hover:bg-surface-light dark:hover:bg-surface-dark',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'group-[.success]:border-success/30 group-[.success]:hover:border-success group-[.success]:hover:bg-success group-[.success]:hover:text-white group-[.success]:focus:ring-success',
        'group-[.error]:border-danger/30 group-[.error]:hover:border-danger group-[.error]:hover:bg-danger group-[.error]:hover:text-white group-[.error]:focus:ring-danger',
        props.class,
      )
    "
    v-bind="props"
  >
    <slot />
  </ToastAction>
</template>
