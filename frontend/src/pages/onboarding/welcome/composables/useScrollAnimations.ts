import { onMounted, onUnmounted, ref, type Ref } from 'vue';

export function useScrollAnimation(
  elementRef: Ref<HTMLElement | null>,
  options: { threshold?: number } = {},
) {
  const { threshold = 0.2 } = options;
  const isVisible = ref(false);
  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    if (!elementRef.value) return;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisible.value = true;
            observer?.unobserve(entry.target);
          }
        });
      },
      { threshold },
    );

    observer.observe(elementRef.value);
  });

  onUnmounted(() => {
    observer?.disconnect();
  });

  return { isVisible };
}

export function useSectionAnimation() {
  const sectionRef = ref<HTMLElement | null>(null);
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { isVisible } = useScrollAnimation(sectionRef);
  const effectiveVisible = prefersReducedMotion ? ref(true) : isVisible;
  return { sectionRef, isVisible: effectiveVisible };
}
