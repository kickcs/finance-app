<script setup lang="ts">
import { UIcon, Skeleton } from '@/shared/ui'
</script>

<template>
  <div class="space-y-2">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <div class="w-6 h-6 rounded-md bg-rose-500/10 flex items-center justify-center">
          <UIcon name="credit_card" size="xs" class="text-rose-500" />
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
      <div
        v-for="i in 2"
        :key="i"
        class="p-3 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Skeleton class="w-9 h-9 rounded-xl" />
            <div class="space-y-1.5">
              <Skeleton class="h-4 w-24 rounded" />
              <Skeleton class="h-3 w-16 rounded" />
            </div>
          </div>
          <div class="text-right space-y-1">
            <Skeleton class="h-4 w-20 rounded" />
            <Skeleton class="h-3 w-14 rounded" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
