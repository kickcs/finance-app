/**
 * Haptic feedback service for mobile devices
 * Uses Navigator Vibration API with graceful fallback
 */

export type HapticPattern =
  | 'tap'
  | 'success'
  | 'error'
  | 'warning'
  | 'swipe-threshold'
  | 'pull-threshold';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: [10, 50, 10],
  error: [50, 25, 50],
  warning: 25,
  'swipe-threshold': 15,
  'pull-threshold': 15,
};

function isSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

function vibrate(pattern: HapticPattern): void {
  if (!isSupported()) return;

  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Silently fail on unsupported devices
  }
}

export const haptics = {
  isSupported,
  vibrate,

  /** Short single tap (10ms) */
  tap(): void {
    vibrate('tap');
  },

  /** Success feedback (10-50-10ms) */
  success(): void {
    vibrate('success');
  },

  /** Error feedback (50-25-50ms) */
  error(): void {
    vibrate('error');
  },

  /** Warning feedback (25ms) */
  warning(): void {
    vibrate('warning');
  },

  /** Swipe threshold crossed (15ms) */
  swipeThreshold(): void {
    vibrate('swipe-threshold');
  },

  /** Pull-to-refresh threshold crossed (15ms) */
  pullThreshold(): void {
    vibrate('pull-threshold');
  },
};
