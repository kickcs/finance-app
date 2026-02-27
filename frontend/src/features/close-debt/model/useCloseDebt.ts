import { ref } from 'vue';
import { debtsApi, debtQueryKeys } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import type { Debt } from '@/shared/api/database.types';

export function useCloseDebt() {
  const { toast } = useToast();
  const isDeleting = ref(false);
  const error = ref<string | null>(null);

  async function deleteDebt(debt: Debt, userId: string): Promise<boolean> {
    isDeleting.value = true;
    error.value = null;

    try {
      await debtsApi.delete(debt.id);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(userId) }),
        invalidateTransactionRelated(queryClient, userId),
        invalidateAccountRelated(queryClient, userId),
      ]);

      toast({ title: 'Долг удалён', variant: 'success' });
      return true;
    } catch (e) {
      console.error('Failed to delete debt:', e);
      error.value = 'Не удалось удалить долг';
      toast({ title: 'Не удалось удалить долг', variant: 'error' });
      return false;
    } finally {
      isDeleting.value = false;
    }
  }

  return {
    isDeleting,
    error,
    deleteDebt,
  };
}
