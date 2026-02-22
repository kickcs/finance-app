<script setup lang="ts">
import { UIcon, Skeleton } from '@/shared/ui';
</script>

<template>
  <div
    class="space-y-3 md:bg-surface-light md:dark:bg-surface-dark md:border md:border-border-light md:dark:border-border-dark md:rounded-3xl md:p-6 md:shadow-sm"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-1 md:px-0 md:mb-2">
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl bg-primary/10 flex items-center justify-center"
        >
          <UIcon name="account_balance_wallet" size="sm" class="text-primary md:hidden" />
          <UIcon name="account_balance_wallet" size="md" class="text-primary hidden md:block" />
        </div>
        <Skeleton class="h-5 md:h-6 w-16 md:w-20 rounded" />
      </div>
      <Skeleton class="h-8 md:h-9 w-24 md:w-28 rounded md:rounded-lg" />
    </div>

    <!-- Account Cards Skeleton -->
    <div
      class="p-3 md:p-4 rounded-2xl md:rounded-2xl bg-card-light/50 dark:bg-card-dark/50 md:bg-card-light md:dark:bg-card-dark border border-white/30 dark:border-white/5 md:border-border-light md:dark:border-border-dark space-y-2 md:space-y-3"
    >
      <Skeleton v-for="i in 2" :key="i" class="h-[72px] md:h-[84px] rounded-xl md:rounded-2xl" />

      <!-- View All Button Skeleton -->
      <Skeleton class="h-10 md:h-12 rounded-xl md:rounded-2xl" />
    </div>
  </div>
</template>
