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
  'group pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-sm transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--reka-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--reka-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full',
  {
    variants: {
      variant: {
        default:
          'border-border-light/50 dark:border-border-dark/50 bg-card-light/95 dark:bg-card-dark/95 text-text-primary-light dark:text-text-primary-dark',
        success:
          'border-success/20 bg-success/10 dark:bg-success/15 text-text-primary-light dark:text-text-primary-dark',
        error:
          'border-danger/20 bg-danger/10 dark:bg-danger/15 text-text-primary-light dark:text-text-primary-dark',
        warning:
          'border-warning/20 bg-warning/10 dark:bg-warning/15 text-text-primary-light dark:text-text-primary-dark',
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
