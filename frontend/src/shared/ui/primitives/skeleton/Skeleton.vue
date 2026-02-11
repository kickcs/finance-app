<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/shared/lib/utils'

interface Props {
  class?: HTMLAttributes['class']
  variant?: 'shimmer' | 'pulse'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'shimmer',
})
</script>

<template>
  <div
    data-slot="skeleton"
    :class="
      cn(
        'rounded-lg',
        props.variant === 'shimmer'
          ? 'animate-shimmer'
          : 'animate-pulse bg-surface-light dark:bg-surface-dark',
        props.class,
      )
    "
  />
</template>
