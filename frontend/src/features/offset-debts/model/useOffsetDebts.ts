import { ref } from 'vue';
import { debtsApi } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useToast } from '@/shared/ui';

/**
 * Зачёт целиком считает и проводит сервер: он трогает два долга и две записи
 * разом, и на клиенте эта цепочка обрывалась бы на полпути. Здесь остаётся
 * только состояние кнопки, сброс кэша и тост.
 */
export function useOffsetDebts() {
  const { toast } = useToast();
  const isOffsetting = ref(false);

  async function offsetDebts(
    personName: string,
    currency: string,
    userId: string,
  ): Promise<boolean> {
    isOffsetting.value = true;
    try {
      const result = await debtsApi.offset(personName, currency);
      await invalidateDebtRelated(queryClient, userId);
      toast({
        title: 'Долги зачтены',
        description: `Списано по ${formatCurrency(result.offset_amount, result.currency)} с каждой стороны`,
        variant: 'success',
      });
      return true;
    } catch (error) {
      console.error('Failed to offset debts:', error);
      toast({ title: 'Не удалось зачесть долги', variant: 'error' });
      return false;
    } finally {
      isOffsetting.value = false;
    }
  }

  return { isOffsetting, offsetDebts };
}
