import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { DEFAULT_CURRENCY } from '@/entities/currency/model/constants';

export function useDemoSetup() {
  const router = useRouter();

  const showDemoSetup = ref(false);
  const demoError = ref<string | null>(null);

  function startDemo() {
    if (showDemoSetup.value) return;
    demoError.value = null;
    showDemoSetup.value = true;
  }

  function onDemoComplete() {
    showDemoSetup.value = false;
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
    localStorage.setItem(STORAGE_KEYS.SELECTED_CURRENCY, DEFAULT_CURRENCY);
    router.push({ name: ROUTE_NAMES.DASHBOARD });
  }

  function onDemoError(error: string) {
    showDemoSetup.value = false;
    demoError.value = error;
  }

  return { showDemoSetup, demoError, startDemo, onDemoComplete, onDemoError };
}
