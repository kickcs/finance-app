<script setup lang="ts">
defineProps<{
  step: number;
}>();
</script>

<template>
  <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-light dark:bg-surface-dark">
    <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <span class="text-sm font-bold text-primary">{{ step }}</span>
    </div>
    <p class="text-sm text-text-primary-light dark:text-text-primary-dark">
      <slot />
    </p>
  </div>
</template>
