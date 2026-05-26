import * as Haptics from 'expo-haptics';

export type HapticPattern =
  | 'selection'
  | 'success'
  | 'error'
  | 'warning'
  | 'light'
  | 'medium'
  | 'heavy';

/**
 * Triggers a haptic feedback pattern. Silent if expo-haptics is unavailable
 * (e.g. iOS simulator without taptic engine) — never throws to caller.
 */
export async function trigger(pattern: HapticPattern): Promise<void> {
  try {
    switch (pattern) {
      case 'selection':
        await Haptics.selectionAsync();
        return;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        return;
    }
  } catch {
    /* haptics unsupported on this device; swallow */
  }
}

export function useHaptics() {
  return { trigger };
}
