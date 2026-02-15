<script setup lang="ts">
import { UCard, Skeleton } from '@/shared/ui';
</script>

<template>
  <UCard class="relative overflow-hidden">
    <!-- Decorative gradient blobs (static) -->
    <div
      class="absolute -top-20 -right-16 w-48 h-48 rounded-full blur-3xl opacity-40"
      style="
        background: radial-gradient(
          circle,
          rgba(59, 130, 246, 0.4) 0%,
          transparent 70%
        );
      "
    />

    <div class="relative z-10 p-6">
      <!-- Balance Section Skeleton -->
      <div class="text-center mb-8">
        <Skeleton class="h-4 w-24 mx-auto rounded mb-3" />
        <Skeleton class="h-12 w-56 mx-auto rounded-xl mb-3" />
        <Skeleton class="h-7 w-36 mx-auto rounded-full" />
      </div>

      <!-- Quick Actions Skeleton -->
      <div class="flex gap-3">
        <Skeleton class="flex-1 h-16 rounded-2xl" />
        <Skeleton class="flex-1 h-16 rounded-2xl" />
      </div>
    </div>
  </UCard>
</template>
