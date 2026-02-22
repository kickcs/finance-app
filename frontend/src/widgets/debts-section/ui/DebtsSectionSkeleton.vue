<script setup lang="ts">
import { UIcon, Skeleton, SkeletonListItem } from '@/shared/ui';
</script>

<template>
  <div
    class="space-y-2 md:rounded-3xl md:bg-surface-light md:dark:bg-surface-dark md:border md:border-border-light md:dark:border-border-dark md:p-6 md:shadow-sm"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-2 md:mb-4">
      <div class="flex items-center gap-1.5">
        <div
          class="w-6 h-6 md:w-8 md:h-8 rounded-md md:rounded-xl bg-danger-light flex items-center justify-center"
        >
          <UIcon name="credit_card" size="xs" class="text-danger md:hidden" />
          <UIcon name="credit_card" size="sm" class="text-danger hidden md:block" />
        </div>
        <Skeleton class="h-4 md:h-5 w-16 md:w-20 rounded" />
      </div>
      <Skeleton class="h-6 w-6 md:w-20 md:h-8 rounded md:rounded-lg" />
    </div>

    <!-- Summary Skeleton -->
    <div class="grid grid-cols-2 gap-1.5 md:gap-3 mb-2 md:mb-5">
      <Skeleton class="h-9 md:h-12 rounded-lg md:rounded-xl" />
      <Skeleton class="h-9 md:h-12 rounded-lg md:rounded-xl" />
    </div>

    <!-- Debts List Skeleton -->
    <div class="space-y-2 md:space-y-3">
      <SkeletonListItem v-for="i in 2" :key="i" class="md:py-1" />
    </div>
  </div>
</template>
