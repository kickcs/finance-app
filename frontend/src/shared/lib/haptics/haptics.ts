import { WebHaptics } from 'web-haptics';
import type { HapticInput, TriggerOptions } from 'web-haptics';

const engine = new WebHaptics();

export function trigger(input?: HapticInput, options?: TriggerOptions) {
  engine.trigger(input, options);
}

export function cancel() {
  engine.cancel();
}

export const isSupported = WebHaptics.isSupported;

/**
 * Vue composable wrapper — returns the same singleton trigger.
 * Safe to call anywhere (no lifecycle hooks registered).
 */
export function useHaptics() {
  return { trigger, cancel, isSupported };
}
