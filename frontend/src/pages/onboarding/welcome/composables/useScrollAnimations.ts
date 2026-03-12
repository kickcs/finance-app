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
