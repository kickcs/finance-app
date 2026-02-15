<script setup lang="ts">
import { Skeleton } from '@/shared/ui';
</script>

<template>
  <div class="flex items-center gap-3 p-3">
    <!-- Icon skeleton -->
    <Skeleton class="shrink-0 w-11 h-11 rounded-xl" />

    <!-- Content skeleton -->
    <div class="flex-1 space-y-2">
      <Skeleton class="h-4 w-32" />
      <Skeleton class="h-3 w-20" />
    </div>

    <!-- Amount skeleton -->
    <Skeleton class="h-5 w-24 shrink-0" />
  </div>
</template>
