<script setup lang="ts">
import { SubscriptionCardSkeleton } from '@/entities/recurring-subscription';
import { Skeleton } from '@/shared/ui';
</script>

<template>
  <div>
    <!-- Header skeleton -->
    <div class="flex items-center justify-between mb-3">
      <Skeleton class="h-5 w-24 rounded" />
      <Skeleton class="h-5 w-12 rounded" />
    </div>

    <div class="space-y-2">
      <SubscriptionCardSkeleton v-for="i in 3" :key="i" />
    </div>
  </div>
</template>
