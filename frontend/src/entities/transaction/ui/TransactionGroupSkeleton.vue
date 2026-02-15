<script setup lang="ts">
import { Skeleton } from '@/shared/ui';
import TransactionItemSkeleton from './TransactionItemSkeleton.vue';

withDefaults(
  defineProps<{
    /** Number of transaction items to show */
    count?: number;
  }>(),
  {
    count: 3,
  },
);
</script>

<template>
  <div class="space-y-2">
    <!-- Date header skeleton -->
    <div class="flex justify-between px-1">
      <Skeleton class="h-4 w-24" />
      <Skeleton class="h-4 w-20" />
    </div>

    <!-- Transaction items container -->
    <div class="rounded-2xl overflow-hidden bg-card-light dark:bg-card-dark">
      <TransactionItemSkeleton v-for="i in count" :key="i" />
    </div>
  </div>
</template>
