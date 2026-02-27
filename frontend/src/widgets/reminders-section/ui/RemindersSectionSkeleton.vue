<script setup lang="ts">
import { UIcon, Skeleton, SkeletonListItem } from '@/shared/ui';
</script>

<template>
  <div class="space-y-2">
    <!-- Header -->
    <div class="flex items-center justify-between mb-2 md:mb-5">
      <div class="flex items-center gap-1.5">
        <div
          class="w-6 h-6 md:w-8 md:h-8 rounded-md md:rounded-xl bg-reminder-light flex items-center justify-center"
        >
          <UIcon name="notifications" size="xs" class="text-reminder md:hidden" />
          <UIcon name="notifications" size="sm" class="text-reminder hidden md:block" />
        </div>
        <Skeleton class="h-4 md:h-5 w-20 md:w-24 rounded" />
      </div>
      <Skeleton class="h-6 w-6 md:w-20 md:h-8 rounded md:rounded-lg" />
    </div>

    <!-- Reminders List Skeleton -->
    <div
      class="rounded-xl md:rounded-2xl overflow-hidden bg-card-light/80 dark:bg-card-dark/80 md:bg-card-light md:dark:bg-card-dark border border-white/30 dark:border-white/5 md:border-border-light md:dark:border-border-dark divide-y divide-border-light dark:divide-border-dark"
    >
      <div v-for="i in 3" :key="i" class="p-3 md:p-4">
        <SkeletonListItem avatar-class="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl" />
      </div>
    </div>
  </div>
</template>
