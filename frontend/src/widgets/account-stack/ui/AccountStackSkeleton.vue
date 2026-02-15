<script setup lang="ts">
import { UIcon, Skeleton } from '@/shared/ui';
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"
        >
          <UIcon name="account_balance_wallet" size="sm" class="text-primary" />
        </div>
        <Skeleton class="h-5 w-16 rounded" />
      </div>
      <Skeleton class="h-8 w-24 rounded" />
    </div>

    <!-- Account Cards Skeleton -->
    <div
      class="p-3 rounded-2xl bg-card-light/50 dark:bg-card-dark/50 border border-white/30 dark:border-white/5 space-y-2"
    >
      <Skeleton v-for="i in 2" :key="i" class="h-[72px] rounded-xl" />

      <!-- View All Button Skeleton -->
      <Skeleton class="h-10 rounded-xl" />
    </div>
  </div>
</template>
