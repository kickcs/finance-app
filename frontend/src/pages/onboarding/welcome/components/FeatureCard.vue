<script setup lang="ts">
defineProps<{
  isVisible: boolean;
  delay: number;
}>();
</script>

<template>
  <div
    class="glass-card gradient-border rounded-2xl p-4 transition-all duration-600"
    :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
    :style="{ transitionDelay: `${delay}s` }"
  >
    <slot />
  </div>
</template>
