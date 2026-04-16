import { useTimeoutFn } from '@vueuse/core';
import { useHaptics } from '@/shared/lib/haptics';
import type { QuickAction } from './types';

const LONG_PRESS_MS = 500;

/**
 * Encapsulates long-press detection (touch + suppress trailing click).
 * Returns the same shape used by both standard and compact quick action grids.
 */
export function useQuickActionLongPress(callbacks: {
  onLongPress: (action: QuickAction | null) => void;
  onClick: (action: QuickAction | null) => void;
}) {
  const { trigger } = useHaptics();
  let target: QuickAction | null = null;
  let triggered = false;

  const { start, stop } = useTimeoutFn(
    () => {
      triggered = true;
      trigger('selection');
      callbacks.onLongPress(target);
    },
    LONG_PRESS_MS,
    { immediate: false },
  );

  function onTouchStart(action: QuickAction | null): void {
    stop();
    triggered = false;
    target = action;
    start();
  }

  function onClick(action: QuickAction | null): void {
    if (triggered) return;
    callbacks.onClick(action);
  }

  return { onTouchStart, onClick, stopLongPress: stop };
}
