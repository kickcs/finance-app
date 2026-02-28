import { computed } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import type { QuickAction } from './types';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

const MAX_SLOTS = 4;

export function useQuickActions() {
  const actions = useLocalStorage<QuickAction[]>(STORAGE_KEYS.QUICK_ACTIONS, []);
  const hidden = useLocalStorage<boolean>(STORAGE_KEYS.QUICK_ACTIONS_HIDDEN, false);

  const slots = computed(() => {
    const result: (QuickAction | null)[] = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      result.push(actions.value[i] ?? null);
    }
    return result;
  });

  function addAction(action: Omit<QuickAction, 'id'>) {
    if (actions.value.length >= MAX_SLOTS) return;
    actions.value = [...actions.value, { ...action, id: crypto.randomUUID() }];
  }

  function updateAction(id: string, updates: Partial<Omit<QuickAction, 'id'>>) {
    actions.value = actions.value.map((a) => (a.id === id ? { ...a, ...updates } : a));
  }

  function removeAction(id: string) {
    actions.value = actions.value.filter((a) => a.id !== id);
  }

  function toggleHidden() {
    hidden.value = !hidden.value;
  }

  return {
    slots,
    actions,
    hidden,
    addAction,
    updateAction,
    removeAction,
    toggleHidden,
  };
}
