<script setup lang="ts">
import { UIcon, Skeleton } from '@/shared/ui';
</script>

<template>
  <div class="space-y-2">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <div
          class="w-6 h-6 rounded-md bg-reminder-light flex items-center justify-center"
        >
          <UIcon name="notifications" size="xs" class="text-reminder" />
        </div>
        <Skeleton class="h-4 w-16 rounded" />
      </div>
      <Skeleton class="h-6 w-6 rounded" />
    </div>

    <!-- Reminders List Skeleton -->
    <div
      class="rounded-xl overflow-hidden bg-card-light/80 dark:bg-card-dark/80 border border-white/30 dark:border-white/5 divide-y divide-border-light dark:divide-border-dark"
    >
      <div v-for="i in 3" :key="i" class="px-3 py-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <Skeleton class="w-8 h-8 rounded-lg" />
            <div class="space-y-1.5">
              <Skeleton class="h-4 w-28 rounded" />
              <Skeleton class="h-3 w-16 rounded" />
            </div>
          </div>
          <Skeleton class="h-5 w-20 rounded" />
        </div>
      </div>
    </div>
  </div>
</template>
