import { useMediaQuery } from '@vueuse/core';
import type { Ref } from 'vue';

let cached: Ref<boolean> | null = null;

export function useIsDesktop(): Ref<boolean> {
  if (!cached) {
    cached = useMediaQuery('(min-width: 1024px)');
  }
  return cached;
}
