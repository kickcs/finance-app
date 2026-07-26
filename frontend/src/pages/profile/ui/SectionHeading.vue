<script setup lang="ts">
defineProps<{
  title: string;
  /** Мета справа — например, версия приложения. */
  meta?: string;
}>();
</script>

<template>
  <div class="mb-2 flex items-baseline justify-between gap-3 px-1">
    <h2
      class="text-caption font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      {{ title }}
    </h2>
    <span v-if="meta" class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
      {{ meta }}
    </span>
  </div>
</template>
