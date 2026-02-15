import { ref, watch, onScopeDispose, type Ref } from 'vue';

/**
 * Reactive localStorage hook
 */
export function useLocalStorage<T>(key: string, defaultValue: T): Ref<T> {
  // Get initial value from localStorage
  const getStoredValue = (): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const storedValue = ref<T>(getStoredValue()) as Ref<T>;

  // Watch for changes and sync to localStorage
  const stopWatch = watch(
    storedValue,
    (newValue) => {
      try {
        localStorage.setItem(key, JSON.stringify(newValue));
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }
    },
    { deep: true },
  );

  // Clean up watcher when the effect scope is disposed
  onScopeDispose(stopWatch);

  return storedValue;
}
