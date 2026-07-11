import { ref, onMounted } from 'vue';
import { usePreferredReducedMotion } from '@vueuse/core';

export function useStaggerAnimation() {
  const isMounted = ref(false);
  const reducedMotion = usePreferredReducedMotion();

  onMounted(() => {
    requestAnimationFrame(() => {
      isMounted.value = true;
    });
  });

  function staggerClass(delay: string) {
    if (reducedMotion.value === 'reduce') return [];
    return [
      'transform transition-[transform,opacity] duration-700 ease-out',
      delay,
      isMounted.value ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
    ];
  }

  return { staggerClass };
}
