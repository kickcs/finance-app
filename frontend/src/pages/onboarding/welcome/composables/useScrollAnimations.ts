import { ref, watchEffect } from 'vue';
import { useIntersectionObserver, usePreferredReducedMotion } from '@vueuse/core';

function useIntersectOnce(observerOptions: { threshold?: number; rootMargin?: string } = {}) {
  const targetRef = ref<HTMLElement | null>(null);
  const triggered = ref(false);
  const prefersReducedMotion = usePreferredReducedMotion();

  watchEffect(() => {
    if (prefersReducedMotion.value === 'reduce') {
      triggered.value = true;
    }
  });

  const { stop } = useIntersectionObserver(
    targetRef,
    ([entry]) => {
      if (entry?.isIntersecting) {
        triggered.value = true;
        stop();
      }
    },
    observerOptions,
  );

  return { targetRef, triggered };
}

export function useSectionAnimation(options: { threshold?: number } = {}) {
  const { targetRef: sectionRef, triggered: isVisible } = useIntersectOnce({
    threshold: options.threshold ?? 0.2,
  });
  return { sectionRef, isVisible };
}

/**
 * Lazy section renderer — mounts component when sentinel enters rootMargin zone.
 * Use with v-if="shouldRender" on the actual component and ref="sentinelRef" on a placeholder div.
 */
export function useLazyRender(rootMargin = '200px') {
  const { targetRef: sentinelRef, triggered: shouldRender } = useIntersectOnce({ rootMargin });
  return { sentinelRef, shouldRender };
}
