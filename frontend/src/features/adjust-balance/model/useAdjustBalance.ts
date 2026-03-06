import { ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { transactionsApi } from '@/entities/transaction';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';

export function useAdjustBalance(userId: () => string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAdjusting = ref(false);

  async function adjustBalance(data: {
    accountId: string;
    targetBalance: number;
    currency: string;
    description?: string;
  }): Promise<boolean> {
    isAdjusting.value = true;
    try {
      await transactionsApi.adjustBalance({
        accountId: data.accountId,
        targetBalance: data.targetBalance,
        currency: data.currency,
        description: data.description || undefined,
      });

      const uid = userId();
      if (uid) {
        await Promise.all([
          invalidateTransactionRelated(queryClient, uid),
          invalidateAccountRelated(queryClient, uid),
        ]);
      }
      return true;
    } catch (e) {
      console.error('Failed to adjust balance:', e);
      toast({
        title: 'Ошибка',
        description: 'Не удалось скорректировать баланс',
        variant: 'error',
      });
      return false;
    } finally {
      isAdjusting.value = false;
    }
  }

  return { adjustBalance, isAdjusting };
}
