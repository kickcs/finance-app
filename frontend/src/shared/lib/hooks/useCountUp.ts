import { computed, ref, watch, onUnmounted, type ComputedRef } from 'vue';
import { usePreferredReducedMotion } from '@vueuse/core';

const DEFAULT_DURATION = 400;

/** ease-out cubic — то же ощущение, что у прежней ручной петли в IncomeExpenseBar. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Анимирует набор чисел одним rAF-тикером.
 *
 * Прежняя реализация заводила отдельную петлю на каждое значение, и две петли
 * писали в свои рефы ~60 раз в секунду — компонент перерисовывался дважды за
 * кадр. Один тикер обновляет все значения разом, поэтому кадр стоит один
 * ререндер независимо от того, сколько чисел анимируется.
 *
 * При `prefers-reduced-motion: reduce` значения присваиваются мгновенно.
 */
export function useCountUp<K extends string>(
  getters: Record<K, () => number>,
  options: { duration?: number } = {},
): Record<K, ComputedRef<number>> {
  const duration = options.duration ?? DEFAULT_DURATION;
  const reducedMotion = usePreferredReducedMotion();

  const keys = Object.keys(getters) as K[];
  const current = ref(Object.fromEntries(keys.map((k) => [k, getters[k]()])) as Record<K, number>);

  let rafId = 0;
  let from: Record<K, number> | null = null;
  let to: Record<K, number> | null = null;
  let startTime = 0;

  function tick(now: number) {
    if (!from || !to) return;

    const t = Math.min((now - startTime) / duration, 1);
    const eased = easeOutCubic(t);

    const next = { ...current.value };
    for (const key of keys) {
      next[key] = from[key] + (to[key] - from[key]) * eased;
    }
    current.value = next;

    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      from = null;
      to = null;
    }
  }

  watch(
    () => keys.map((k) => getters[k]()),
    (targets) => {
      const nextTo = Object.fromEntries(keys.map((k, i) => [k, targets[i]])) as Record<K, number>;
      if (keys.every((k) => current.value[k] === nextTo[k])) return;

      if (reducedMotion.value === 'reduce') {
        current.value = nextTo;
        return;
      }

      cancelAnimationFrame(rafId);
      from = { ...current.value };
      to = nextTo;
      startTime = performance.now();
      rafId = requestAnimationFrame(tick);
    },
  );

  onUnmounted(() => cancelAnimationFrame(rafId));

  return Object.fromEntries(keys.map((k) => [k, computed(() => current.value[k])])) as Record<
    K,
    ComputedRef<number>
  >;
}
