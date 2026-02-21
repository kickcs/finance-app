import { watch } from 'vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { useToast } from './useToast';

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

export function usePwaUpdate() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Periodically check for new SW updates
      setInterval(() => {
        registration.update();
      }, UPDATE_CHECK_INTERVAL);
    },
  });
  const { toast } = useToast();

  watch(needRefresh, (isNeeded) => {
    if (isNeeded) {
      toast({
        title: 'Доступно обновление 🚀',
        description: 'Улучшения загружены и готовы к установке',
        variant: 'success',
        duration: 9999999, // Essentially infinite until user clicks
        action: {
          label: 'Обновить',
          onClick: () => {
            updateServiceWorker(true);
          },
        },
      });
    }
  });

  return {
    needRefresh,
    updateServiceWorker,
  };
}
