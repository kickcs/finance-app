<script setup lang="ts">
import type { ToastRootEmits, ToastRootProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';
import { ToastRoot, useForwardPropsEmits } from 'reka-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const props = withDefaults(
  defineProps<
    ToastRootProps & {
      class?: HTMLAttributes['class'];
      variant?: ToastVariants['variant'];
      position?: 'top' | 'bottom';
    }
  >(),
  { position: 'bottom' },
);

const emits = defineEmits<ToastRootEmits>();

const toastVariants = cva(
  'group pointer-events-auto relative flex w-auto max-w-[min(90vw,360px)] items-center gap-2.5 overflow-hidden rounded-2xl border px-3.5 py-2.5 shadow-lg backdrop-blur-md transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--reka-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--reka-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=open]:duration-300 data-[state=closed]:duration-200 mt-1.5',
  {
    variants: {
      variant: {
        default:
          'border-border-light/40 dark:border-border-dark/50 bg-card-light/80 dark:bg-card-dark/80 text-text-primary-light dark:text-text-primary-dark shadow-black/5 dark:shadow-black/20',
        success:
          'border-success/30 bg-success/15 dark:bg-success/20 text-text-primary-light dark:text-text-primary-dark shadow-success/5',
        error:
          'border-danger/30 bg-danger/15 dark:bg-danger/20 text-text-primary-light dark:text-text-primary-dark shadow-danger/5',
        warning:
          'border-warning/30 bg-warning/15 dark:bg-warning/20 text-text-primary-light dark:text-text-primary-dark shadow-warning/5',
        undo: 'border-border-light/40 dark:border-border-dark/50 bg-card-light/85 dark:bg-card-dark/85 text-text-primary-light dark:text-text-primary-dark shadow-black/5 dark:shadow-black/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type ToastVariants = VariantProps<typeof toastVariants>;

const delegatedProps = computed(() => {
  const { class: _, variant: __, position: ___, ...rest } = props;
  return rest;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);

const slideClasses = computed(() =>
  props.position === 'top'
    ? 'data-[state=open]:slide-in-from-top-full data-[state=closed]:slide-out-to-top-full'
    : 'data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full',
);
</script>

<template>
  <ToastRoot v-bind="forwarded" :class="cn(toastVariants({ variant }), slideClasses, props.class)">
    <slot />
  </ToastRoot>
</template>
