import { watch } from 'vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { useToast } from './useToast';

export function usePwaUpdate() {
  const { needRefresh, updateServiceWorker } = useRegisterSW();
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
