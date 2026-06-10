import { ref } from 'vue';
import { debtsApi, snapshotDebtCaches, restoreDebtCaches, applyDebtRemove } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import type { Debt } from '@/shared/api/database.types';

export function useCloseDebt() {
  const { toast } = useToast();
  const isDeleting = ref(false);
  const error = ref<string | null>(null);

  async function deleteDebt(debt: Debt, userId: string): Promise<boolean> {
    isDeleting.value = true;
    error.value = null;

    // Optimistically drop the debt from all caches, roll back on failure
    const snapshot = await snapshotDebtCaches(queryClient);
    applyDebtRemove(queryClient, debt.id);

    try {
      await debtsApi.delete(debt.id);

      await invalidateDebtRelated(queryClient, userId);

      toast({ title: 'Долг удалён', variant: 'success' });
      return true;
    } catch (e) {
      restoreDebtCaches(queryClient, snapshot);
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
