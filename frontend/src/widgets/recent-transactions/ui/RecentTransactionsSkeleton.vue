<script setup lang="ts">
import { Skeleton, SkeletonListItem } from '@/shared/ui';
</script>

<template>
  <div class="space-y-1">
    <div class="flex items-center justify-between mb-3">
      <Skeleton class="h-5 w-40" />
      <Skeleton class="h-4 w-12" />
    </div>
    <SkeletonListItem v-for="i in 3" :key="i" />
  </div>
</template>
