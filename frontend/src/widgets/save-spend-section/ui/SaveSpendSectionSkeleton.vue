<script setup lang="ts">
import { UCard, UIcon, Skeleton } from '@/shared/ui';
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <UIcon name="calendar_month" size="sm" class="text-primary" />
        </div>
        <Skeleton class="h-5 w-24 rounded" />
      </div>
    </div>

    <!-- Cards Skeleton -->
    <div class="flex flex-col gap-3">
      <UCard v-for="i in 2" :key="i" class="p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <Skeleton class="w-9 h-9 rounded-xl" />
            <Skeleton class="h-4 w-20 rounded" />
          </div>
          <Skeleton class="h-7 w-28 rounded" />
        </div>
        <Skeleton class="h-2 rounded-full" />
      </UCard>
    </div>
  </div>
</template>
