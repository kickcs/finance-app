import { ref, watch, onUnmounted, toValue, type MaybeRefOrGetter } from 'vue';
import { usePreferredReducedMotion } from '@vueuse/core';

const prefersReducedMotion = usePreferredReducedMotion();

function easeOutQuad(t: number): number {
  return t * (2 - t);
}

export function useCountUp(
  target: MaybeRefOrGetter<number>,
  isVisible: MaybeRefOrGetter<boolean>,
  options: {
    duration?: number;
    format?: (n: number) => string;
  } = {},
) {
  const { duration = 1500, format = (n) => n.toLocaleString('ru-RU') } = options;
  const display = ref(format(0));
  let animationId: number | null = null;

  function animate() {
    if (animationId) cancelAnimationFrame(animationId);

    if (prefersReducedMotion.value === 'reduce') {
      display.value = format(toValue(target));
      return;
    }

    const startTime = performance.now();
    const startValue = 0;
    const endValue = toValue(target);

    function step(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuad(progress);
      const currentValue = startValue + (endValue - startValue) * easedProgress;

      display.value = format(currentValue);

      if (progress < 1) {
        animationId = requestAnimationFrame(step);
      } else {
        animationId = null;
      }
    }

    animationId = requestAnimationFrame(step);
  }

  watch(
    () => toValue(isVisible),
    (visible) => {
      if (visible) animate();
    },
  );

  onUnmounted(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  });

  return display;
}
