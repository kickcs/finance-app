<script setup lang="ts">
defineProps<{ version: string; current?: boolean }>();
</script>

<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded-md text-caption font-mono font-medium tracking-tight"
    :class="
      current
        ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-hover'
        : 'bg-surface-light dark:bg-surface-dark text-text-tertiary-light dark:text-text-tertiary-dark'
    "
  >
    {{ version }}
  </span>
</template>
