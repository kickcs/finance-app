<script setup lang="ts">
import { Skeleton } from '@/shared/ui';

withDefaults(
  defineProps<{
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);
</script>

<template>
  <div
    :class="[
      'w-full rounded-xl bg-card-light dark:bg-card-dark',
      'border border-border-light dark:border-border-dark',
      compact ? 'p-2.5' : 'p-3',
    ]"
  >
    <div class="flex items-center gap-2.5">
      <!-- Icon skeleton -->
      <Skeleton class="shrink-0 w-9 h-9 rounded-lg" />

      <!-- Content skeleton -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1 space-y-1.5">
            <Skeleton class="h-4 w-28" />
            <Skeleton class="h-3 w-20" />
          </div>
          <!-- Amount skeleton -->
          <div class="text-right shrink-0 space-y-1.5">
            <Skeleton class="h-4 w-24" />
            <Skeleton class="h-3 w-16" />
          </div>
        </div>

        <!-- Progress bar skeleton -->
        <Skeleton class="h-1 w-full mt-1.5 rounded-full" />
      </div>
    </div>
  </div>
</template>
