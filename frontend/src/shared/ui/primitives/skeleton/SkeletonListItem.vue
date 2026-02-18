<script setup lang="ts">
import Skeleton from './Skeleton.vue';

interface Props {
  showTrailing?: boolean;
  avatarClass?: string;
}

withDefaults(defineProps<Props>(), {
  showTrailing: true,
  avatarClass: 'w-9 h-9 rounded-xl',
});
</script>

<template>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Skeleton :class="avatarClass" />
      <div class="space-y-1.5">
        <Skeleton class="h-4 w-24 rounded" />
        <Skeleton class="h-3 w-16 rounded" />
      </div>
    </div>
    <div v-if="showTrailing" class="text-right space-y-1">
      <Skeleton class="h-4 w-20 rounded" />
      <Skeleton class="h-3 w-14 rounded" />
    </div>
  </div>
</template>
