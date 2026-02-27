import { ref } from 'vue';
import { subscriptionApi } from '@/entities/subscription';
import { useToast } from '@/shared/ui';

export function useUpgrade() {
  const { toast } = useToast();
  const isLoading = ref(false);

  async function startCheckout(plan: 'premium_monthly' | 'premium_yearly'): Promise<boolean> {
    isLoading.value = true;
    try {
      const { checkout_url } = await subscriptionApi.createCheckout(plan);
      if (window.LemonSqueezy) {
        window.LemonSqueezy.Url.Open(checkout_url);
      } else {
        window.open(checkout_url, '_blank');
      }
      return true;
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось открыть страницу оплаты',
        variant: 'error',
      });
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  return { isLoading, startCheckout };
}
