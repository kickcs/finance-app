<script setup lang="ts">
import type { ToastRootEmits, ToastRootProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';
import { ToastRoot, useForwardPropsEmits } from 'reka-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const props = defineProps<
  ToastRootProps & {
    class?: HTMLAttributes['class'];
    variant?: ToastVariants['variant'];
  }
>();

const emits = defineEmits<ToastRootEmits>();

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-[1.25rem] border px-4 py-3.5 shadow-xl backdrop-blur-md transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--reka-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--reka-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-bottom-full data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-bottom-full data-[state=open]:zoom-in-95 data-[state=open]:duration-300 data-[state=closed]:duration-200 mt-2',
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
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type ToastVariants = VariantProps<typeof toastVariants>;

const delegatedProps = computed(() => {
  const { class: _, variant: __, ...rest } = props;
  return rest;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <ToastRoot
    v-bind="forwarded"
    :class="cn(toastVariants({ variant }), props.class)"
  >
    <slot />
  </ToastRoot>
</template>
