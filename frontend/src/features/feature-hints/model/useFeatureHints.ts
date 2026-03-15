import { ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { HINT_CONFIGS, STORAGE_KEYS } from './constants';
import type { HintId, DotId, CounterKey } from './types';

// Module-level singletons — shared across all callers, reset on page reload
const hintShownThisSession = ref(false);
const dismissed = useLocalStorage<Record<string, boolean>>(STORAGE_KEYS.HINTS_DISMISSED, {});
const counters = useLocalStorage<Record<string, number>>(STORAGE_KEYS.HINTS_COUNTERS, {});
const dotsDismissed = useLocalStorage<Record<string, boolean>>(STORAGE_KEYS.DISCOVERY_DOTS, {});

export function useFeatureHints() {
  function incrementCounter(key: CounterKey) {
    counters.value[key] = (counters.value[key] ?? 0) + 1;
  }

  function shouldShowHint(hintId: HintId): boolean {
    if (hintShownThisSession.value) return false;
    if (dismissed.value[hintId]) return false;
    const config = HINT_CONFIGS[hintId];
    if (!config) return false;
    return (counters.value[config.triggerCounter] ?? 0) >= config.triggerThreshold;
  }

  function dismissHint(hintId: HintId) {
    dismissed.value[hintId] = true;
    hintShownThisSession.value = true;
  }

  function markHintShown() {
    hintShownThisSession.value = true;
  }

  function isDotDismissed(dotId: DotId): boolean {
    return !!dotsDismissed.value[dotId];
  }

  function dismissDot(dotId: DotId) {
    dotsDismissed.value[dotId] = true;
  }

  return {
    incrementCounter,
    shouldShowHint,
    dismissHint,
    markHintShown,
    isDotDismissed,
    dismissDot,
    getHintConfig: (id: HintId) => HINT_CONFIGS[id] ?? null,
  };
}
