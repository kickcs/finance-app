<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { router } from '@/app/router';

const isVisible = ref(false);
const isFinishing = ref(false);

const SHOW_DELAY = 150; // Don't show for fast navigations
const HIDE_DELAY = 300; // Keep visible briefly after navigation completes

const { start: startShowTimer, stop: stopShowTimer } = useTimeoutFn(() => {
  isVisible.value = true;
}, SHOW_DELAY, { immediate: false });

const { start: startHideTimer, stop: stopHideTimer } = useTimeoutFn(() => {
  isVisible.value = false;
  isFinishing.value = false;
}, HIDE_DELAY, { immediate: false });

function cleanup() {
  stopShowTimer();
  stopHideTimer();
}

function startProgress() {
  cleanup();
  isFinishing.value = false;
  startShowTimer();
}

function finishProgress() {
  cleanup();
  if (!isVisible.value) return;

  isFinishing.value = true;
  startHideTimer();
}

let removeBeforeEach: (() => void) | null = null;
let removeAfterEach: (() => void) | null = null;

onMounted(() => {
  removeBeforeEach = router.beforeEach(() => {
    startProgress();
  });

  removeAfterEach = router.afterEach(() => {
    finishProgress();
  });
});

onUnmounted(() => {
  cleanup();
  removeBeforeEach?.();
  removeAfterEach?.();
});
</script>

<template>
  <div v-if="isVisible" class="fixed top-0 left-0 right-0 z-50 h-[2px] safe-area-inset-top">
    <div
      class="h-full w-full"
      :class="isFinishing ? 'nav-progress-finish' : 'nav-progress-loading'"
    />
  </div>
</template>

<style scoped>
.nav-progress-loading {
  background: var(--color-primary);
  animation: progress-indeterminate 1.5s ease-in-out infinite;
  transform-origin: left;
}

.nav-progress-finish {
  background: var(--color-primary);
  animation: progress-complete 0.3s ease-out forwards;
  transform-origin: left;
}

@keyframes progress-indeterminate {
  0% {
    transform: scaleX(0) translateX(0);
  }
  50% {
    transform: scaleX(0.6) translateX(30%);
  }
  100% {
    transform: scaleX(0) translateX(100%);
  }
}

@keyframes progress-complete {
  from {
    transform: scaleX(0.6);
    opacity: 1;
  }
  to {
    transform: scaleX(1);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-progress-loading,
  .nav-progress-finish {
    animation: none;
    transform: scaleX(1);
    opacity: 0.7;
  }
  .nav-progress-finish {
    opacity: 0;
  }
}
</style>
