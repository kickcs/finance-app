<script setup lang="ts">
import { Skeleton } from '@/shared/ui';
</script>

<template>
  <div
    class="rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-4 space-y-3"
  >
    <!-- Header skeleton -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Skeleton class="w-8 h-8 rounded-lg" />
        <Skeleton class="h-4 w-28 rounded" />
      </div>
      <Skeleton class="h-4 w-14 rounded" />
    </div>

    <!-- Amount skeleton -->
    <Skeleton class="h-5 w-40 rounded" />

    <!-- Progress bar skeleton -->
    <Skeleton class="h-2 w-full rounded-full" />

    <!-- Footer skeleton -->
    <div class="flex items-center justify-between">
      <Skeleton class="h-3 w-24 rounded" />
      <Skeleton class="h-3 w-28 rounded" />
    </div>
  </div>
</template>
