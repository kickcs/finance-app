import { ref, type MaybeRefOrGetter } from 'vue';
import { useDebtMutations } from '@/entities/debt';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useToast } from '@/shared/ui';

/**
 * Зачёт целиком считает и проводит сервер: он трогает два долга и две записи
 * разом, и на клиенте эта цепочка обрывалась бы на полпути. Здесь остаётся
 * только состояние кнопки и тост — новые остатки приезжают в ответе и их
 * применяет мутация.
 */
export function useOffsetDebts(userId: MaybeRefOrGetter<string | null>) {
  const { toast } = useToast();
  const { offsetDebts: runOffset } = useDebtMutations(userId);
  const isOffsetting = ref(false);

  async function offsetDebts(personName: string, currency: string): Promise<boolean> {
    isOffsetting.value = true;
    try {
      const result = await runOffset(personName, currency);
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
