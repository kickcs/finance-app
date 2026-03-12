<script setup lang="ts">
defineProps<{
  isVisible: boolean;
  delay: number;
}>();
</script>

<template>
  <div
    class="rounded-xl border border-purple-500/15 bg-white/[0.06] p-4 transition-all duration-500"
    :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
    :style="{ transitionDelay: `${delay}s` }"
  >
    <slot />
  </div>
</template>
