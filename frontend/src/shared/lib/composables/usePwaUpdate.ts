import { watch, type Ref, ref } from 'vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { useToast } from './useToast';

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

// Singleton state — SW registration happens once in App.vue
const needRefresh: Ref<boolean> = ref(false);
const updateServiceWorker = ref<(reloadPage?: boolean) => Promise<void>>();

let initialized = false;

export function usePwaUpdate() {
  if (!initialized) {
    const sw = useRegisterSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        setInterval(() => {
          registration.update();
        }, UPDATE_CHECK_INTERVAL);
      },
    });
    // Sync singleton refs with SW state
    watch(sw.needRefresh, (v) => (needRefresh.value = v), { immediate: true });
    updateServiceWorker.value = sw.updateServiceWorker;
    initialized = true;
  }

  return {
    needRefresh,
    updateServiceWorker: updateServiceWorker.value!,
  };
}

/** Show update toast when available — call from dashboard page */
export function usePwaUpdateToast() {
  const { needRefresh: swNeedRefresh, updateServiceWorker: swUpdate } = usePwaUpdate();
  const { toast } = useToast();
  let shown = false;

  const showToast = () => {
    if (shown) return;
    shown = true;
    toast({
      title: 'Доступно обновление 🚀',
      description: 'Улучшения загружены и готовы к установке',
      variant: 'success',
      duration: 9999999,
      action: {
        label: 'Обновить',
        onClick: () => swUpdate(true),
      },
    });
  };

  watch(
    swNeedRefresh,
    (isNeeded) => {
      if (isNeeded) showToast();
    },
    { immediate: true },
  );
}
