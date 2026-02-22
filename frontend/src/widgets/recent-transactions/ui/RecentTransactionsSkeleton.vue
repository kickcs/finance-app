<script setup lang="ts">
import { Skeleton, SkeletonListItem } from '@/shared/ui';
</script>

<template>
  <div
    class="space-y-1 h-full md:bg-surface-light md:dark:bg-surface-dark md:rounded-3xl md:p-6 md:border md:border-border-light md:dark:border-border-dark md:shadow-sm"
  >
    <div class="flex items-center justify-between mb-4 md:mb-6">
      <Skeleton class="h-5 w-40" />
      <Skeleton class="h-4 w-12" />
    </div>
    <div class="space-y-3">
      <SkeletonListItem v-for="i in 5" :key="i" class="md:py-1" />
    </div>
  </div>
</template>
