import { ref } from 'vue';

export function useAsyncOperation<TArgs extends unknown[], TResult = boolean>(
  fn: (...args: TArgs) => Promise<TResult>,
  options?: { errorMessage?: string },
) {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function execute(...args: TArgs): Promise<TResult | false> {
    isLoading.value = true;
    error.value = null;
    try {
      const result = await fn(...args);
      return result;
    } catch (e) {
      error.value = options?.errorMessage ?? 'Произошла ошибка';
      console.error(e);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  return { isLoading, error, execute };
}
