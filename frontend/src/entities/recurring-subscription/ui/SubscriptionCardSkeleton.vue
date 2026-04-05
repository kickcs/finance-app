<script setup lang="ts">
import { Skeleton } from '@/shared/ui';
</script>

<template>
  <div
    class="w-full rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-3"
  >
    <div class="flex items-center gap-2.5">
      <!-- Icon placeholder -->
      <Skeleton class="w-10 h-10 rounded-lg shrink-0" />

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1 space-y-1.5">
            <Skeleton class="h-4 w-24 rounded" />
            <Skeleton class="h-3 w-32 rounded" />
          </div>
          <div class="text-right space-y-1.5">
            <Skeleton class="h-4 w-16 rounded ml-auto" />
            <Skeleton class="h-3 w-10 rounded ml-auto" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
