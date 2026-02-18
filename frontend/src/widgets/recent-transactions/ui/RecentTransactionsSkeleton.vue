<script setup lang="ts">
import { Skeleton } from '@/shared/ui';
</script>

<template>
  <div class="space-y-1">
    <div class="flex items-center justify-between mb-3">
      <Skeleton class="h-5 w-40" />
      <Skeleton class="h-4 w-12" />
    </div>
    <div v-for="i in 3" :key="i" class="flex items-center gap-3 p-3">
      <Skeleton class="shrink-0 w-9 h-9 rounded-lg" />
      <div class="flex-1 space-y-1.5">
        <Skeleton class="h-4 w-28" />
        <Skeleton class="h-3 w-16" />
      </div>
      <Skeleton class="h-4 w-20 shrink-0" />
    </div>
  </div>
</template>
