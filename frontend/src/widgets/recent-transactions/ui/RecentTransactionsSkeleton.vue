<script setup lang="ts">
import { Skeleton, SkeletonListItem } from '@/shared/ui';
</script>

<template>
  <div class="space-y-1 h-full">
    <div class="flex items-center justify-between mb-4 md:mb-6">
      <Skeleton class="h-5 w-40" />
      <Skeleton class="h-4 w-12" />
    </div>
    <div class="space-y-3">
      <!-- 5 on mobile, 10 on desktop -->
      <SkeletonListItem v-for="i in 5" :key="i" />
      <SkeletonListItem v-for="i in 5" :key="'d' + i" class="hidden md:block" />
    </div>
  </div>
</template>
