import { ref } from 'vue';
import { debtsApi, applyDebtUpdate } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';

/**
 * Отмена закрытия долга. Оптимистичного патча здесь нет намеренно: восстановленный
 * остаток считает сервер по уцелевшим возвратам, и угадывать его на клиенте
 * значило бы показать неверную сумму ровно в тот момент, когда пользователь
 * пришёл исправлять неверную сумму.
 */
export function useReopenDebt() {
  const { toast } = useToast();
  const isReopening = ref(false);

  async function reopenDebt(debtId: string, userId: string): Promise<boolean> {
    if (isReopening.value) return false;
    isReopening.value = true;

    try {
      const debt = await debtsApi.reopen(debtId);

      applyDebtUpdate(queryClient, debtId, debt);
      await invalidateDebtRelated(queryClient, userId);

      toast({ title: 'Закрытие отменено', variant: 'success' });
      return true;
    } catch (e) {
      console.error('Failed to reopen debt:', e);
      toast({ title: 'Не удалось отменить закрытие', variant: 'error' });
      return false;
    } finally {
      isReopening.value = false;
    }
  }

  return { isReopening, reopenDebt };
}
