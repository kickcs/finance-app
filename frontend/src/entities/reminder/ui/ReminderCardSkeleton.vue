<script setup lang="ts">
import { Skeleton } from '@/shared/ui'

withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)
</script>

<template>
  <div
    :class="[
      'w-full flex items-center gap-2.5 rounded-lg',
      compact ? 'p-2' : 'p-2.5',
    ]"
  >
    <!-- Icon skeleton -->
    <Skeleton class="shrink-0 w-8 h-8 rounded-lg" />

    <!-- Content skeleton -->
    <div class="flex-1 min-w-0 space-y-1.5">
      <Skeleton class="h-4 w-28" />
      <Skeleton class="h-3 w-16" />
    </div>

    <!-- Amount/date skeleton -->
    <div class="text-right shrink-0 space-y-1.5">
      <Skeleton class="h-4 w-20" />
      <Skeleton class="h-3 w-14" />
    </div>
  </div>
</template>
