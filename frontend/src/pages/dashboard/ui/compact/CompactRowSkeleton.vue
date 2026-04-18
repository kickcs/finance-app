<script setup lang="ts">
import { Skeleton } from '@/shared/ui';

withDefaults(
  defineProps<{
    /** Number of skeleton rows to render. */
    count?: number;
  }>(),
  { count: 2 },
);
</script>

<template>
  <div
    v-for="i in count"
    :key="`row-sk-${i}`"
    class="flex items-center gap-2.5 px-3 py-2.5"
    :class="{ 'border-t border-border-light dark:border-border-dark': i !== 1 }"
  >
    <Skeleton class="w-7 h-7 rounded-lg shrink-0" />
    <div class="flex-1 space-y-1">
      <Skeleton class="h-3 w-24 rounded" />
      <Skeleton class="h-2.5 w-16 rounded" />
    </div>
    <Skeleton class="h-3.5 w-16 rounded" />
  </div>
</template>
