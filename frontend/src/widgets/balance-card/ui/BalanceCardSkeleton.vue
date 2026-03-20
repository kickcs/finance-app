<script setup lang="ts">
import { UCard, Skeleton } from '@/shared/ui';
</script>

<template>
  <UCard class="relative overflow-hidden">
    <!-- Decorative gradient blob (static) -->
    <div
      class="absolute -top-20 -right-16 w-48 h-48 rounded-full blur-3xl opacity-40"
      style="
        background: radial-gradient(
          circle,
          color-mix(in srgb, var(--color-primary) 40%, transparent) 0%,
          transparent 70%
        );
      "
    />

    <div class="relative z-10 p-5">
      <div class="flex items-center justify-between gap-4">
        <!-- Left: Balance skeleton -->
        <div class="flex flex-col gap-1.5">
          <Skeleton class="h-3.5 w-20 rounded" />
          <Skeleton class="h-9 w-44 rounded-xl" />
        </div>

        <!-- Right: Daily limit skeleton -->
        <div class="flex flex-col items-end gap-1.5">
          <Skeleton class="h-3 w-12 rounded" />
          <Skeleton class="h-7 w-32 rounded-xl" />
          <Skeleton class="h-2.5 w-20 rounded" />
        </div>
      </div>
    </div>
  </UCard>
</template>
