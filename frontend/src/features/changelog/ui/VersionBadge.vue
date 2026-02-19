<script setup lang="ts">
defineProps<{ version: string }>();
</script>

<template>
  <span
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-primary to-primary/80 text-white"
  >
    v{{ version }}
  </span>
</template>
