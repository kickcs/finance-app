<script setup lang="ts">
import type { ToastRootEmits, ToastRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { ToastRoot, useForwardPropsEmits } from 'reka-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-xl border p-4 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--reka-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--reka-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark text-text-primary-light dark:text-text-primary-dark',
        success: 'border-success/30 bg-success/10 text-success',
        error: 'border-danger/30 bg-danger/10 text-danger',
        warning: 'border-warning/30 bg-warning/10 text-warning',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

type ToastVariants = VariantProps<typeof toastVariants>

const props = defineProps<ToastRootProps & { class?: HTMLAttributes['class'], variant?: ToastVariants['variant'] }>()

const emits = defineEmits<ToastRootEmits>()

const delegatedProps = computed(() => {
  const { class: _, variant: __, ...rest } = props
  return rest
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ToastRoot
    v-bind="forwarded"
    :class="cn(toastVariants({ variant }), props.class)"
  >
    <slot />
  </ToastRoot>
</template>
