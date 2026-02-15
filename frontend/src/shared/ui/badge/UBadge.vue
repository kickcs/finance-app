<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'bg-primary-light text-primary',
        success: 'bg-success-light text-success',
        danger: 'bg-danger-light text-danger',
        warning: 'bg-warning-light text-warning',
        neutral: 'bg-neutral-light text-neutral',
        'debt-given': 'bg-debt-given-light text-debt-given',
        'debt-received': 'bg-debt-received-light text-debt-received',
        goal: 'bg-goal-light text-goal-text dark:text-goal-text-dark',
        reminder: 'bg-reminder-light text-reminder',
      },
      size: {
        xs: 'px-1.5 py-0.5 text-caption-sm',
        sm: 'px-2 py-0.5 text-caption',
        md: 'px-2.5 py-1 text-xs',
      },
      shape: {
        rounded: 'rounded-md',
        pill: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'sm',
      shape: 'rounded',
    },
  }
)

type BadgeVariants = VariantProps<typeof badgeVariants>

defineProps<{
  variant?: BadgeVariants['variant']
  size?: BadgeVariants['size']
  shape?: BadgeVariants['shape']
  class?: string
}>()
</script>

<template>
  <span
    :class="cn(
      badgeVariants({ variant, size, shape }),
      $props.class,
    )"
  >
    <slot />
  </span>
</template>
