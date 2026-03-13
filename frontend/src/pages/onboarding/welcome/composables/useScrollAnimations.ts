import { ref, watchEffect } from 'vue';
import { useIntersectionObserver, usePreferredReducedMotion } from '@vueuse/core';

export function useSectionAnimation(options: { threshold?: number } = {}) {
  const { threshold = 0.2 } = options;
  const sectionRef = ref<HTMLElement | null>(null);
  const isVisible = ref(false);
  const prefersReducedMotion = usePreferredReducedMotion();

  watchEffect(() => {
    if (prefersReducedMotion.value === 'reduce') {
      isVisible.value = true;
    }
  });

  const { stop } = useIntersectionObserver(
    sectionRef,
    ([entry]) => {
      if (entry?.isIntersecting) {
        isVisible.value = true;
        stop();
      }
    },
    { threshold },
  );

  return { sectionRef, isVisible };
}

/**
 * Lazy section renderer — mounts component when sentinel enters rootMargin zone.
 * Use with v-if="shouldRender" on the actual component and ref="sentinelRef" on a placeholder div.
 */
export function useLazyRender(rootMargin = '200px') {
  const sentinelRef = ref<HTMLElement | null>(null);
  const shouldRender = ref(false);
  const prefersReducedMotion = usePreferredReducedMotion();

  watchEffect(() => {
    if (prefersReducedMotion.value === 'reduce') {
      shouldRender.value = true;
    }
  });

  const { stop } = useIntersectionObserver(
    sentinelRef,
    ([entry]) => {
      if (entry?.isIntersecting) {
        shouldRender.value = true;
        stop();
      }
    },
    { rootMargin },
  );

  return { sentinelRef, shouldRender };
}
