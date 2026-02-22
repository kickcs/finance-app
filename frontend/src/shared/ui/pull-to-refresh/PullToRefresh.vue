<script setup lang="ts">
import { computed, toRef } from 'vue';
import { usePullToRefresh } from '@/shared/lib/hooks/usePullToRefresh';
import { onBeforeRouteLeave } from 'vue-router';

const props = defineProps<{
  onRefresh: () => Promise<void>;
  containerRef?: HTMLElement | null;
}>();

const THRESHOLD = 64;

const { pullDistance, isRefreshing, isPulling, isThresholdReached, resetPull } = usePullToRefresh({
  threshold: THRESHOLD,
  onRefresh: props.onRefresh,
  containerRef: toRef(props, 'containerRef'),
});

const contentStyle = computed(() => {
  if (pullDistance.value === 0) return {};
  return {
    transform: `translateY(${pullDistance.value}px)`,
    willChange: 'transform',
  };
});

const contentTransition = computed(() => (isPulling.value ? 'none' : 'transform 300ms ease-out'));

const spinnerOpacity = computed(() =>
  isRefreshing.value ? 1 : Math.min(pullDistance.value / THRESHOLD, 1),
);

const spinnerTop = computed(
  () => pullDistance.value / 2 - 12, // Center spinner in pull area (12 = half of w-6)
);

// Reset PTR on route leave to prevent visual glitch during page transitions
onBeforeRouteLeave(() => {
  resetPull();
});
</script>

<template>
  <div class="relative" style="overscroll-behavior-y: contain">
    <!-- Spinner indicator -->
    <div
      v-if="pullDistance > 0 || isRefreshing"
      class="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
      :style="{ top: `${spinnerTop}px`, opacity: spinnerOpacity }"
    >
      <div
        class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
        :class="{ 'animate-spin': isRefreshing || isThresholdReached }"
      />
    </div>

    <!-- Content -->
    <div :style="{ ...contentStyle, transition: contentTransition }">
      <slot />
    </div>
  </div>
</template>
