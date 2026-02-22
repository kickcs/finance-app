import { ref } from 'vue';
import { subscriptionApi } from '@/entities/subscription';
import { useToast } from '@/shared/ui';

export function useUpgrade() {
  const { toast } = useToast();
  const isLoading = ref(false);

  async function startCheckout(plan: 'premium_monthly' | 'premium_yearly') {
    isLoading.value = true;
    try {
      const { checkout_url } = await subscriptionApi.createCheckout(plan);
      if ((window as any).LemonSqueezy) {
        (window as any).LemonSqueezy.Url.Open(checkout_url);
      } else {
        window.open(checkout_url, '_blank');
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось открыть страницу оплаты', variant: 'error' });
    } finally {
      isLoading.value = false;
    }
  }

  return { isLoading, startCheckout };
}
