<script setup lang="ts">
import { UIcon, Skeleton, SkeletonListItem } from '@/shared/ui';
</script>

<template>
  <div class="space-y-2">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <div
          class="w-6 h-6 rounded-md bg-danger-light flex items-center justify-center"
        >
          <UIcon name="credit_card" size="xs" class="text-danger" />
        </div>
        <Skeleton class="h-4 w-12 rounded" />
      </div>
      <Skeleton class="h-6 w-6 rounded" />
    </div>

    <!-- Summary Skeleton -->
    <div class="grid grid-cols-2 gap-1.5">
      <Skeleton class="h-9 rounded-lg" />
      <Skeleton class="h-9 rounded-lg" />
    </div>

    <!-- Debts List Skeleton -->
    <div class="space-y-2">
      <SkeletonListItem v-for="i in 2" :key="i" />
    </div>
  </div>
</template>
