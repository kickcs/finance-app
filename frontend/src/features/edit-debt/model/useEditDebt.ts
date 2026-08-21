import { ref, computed, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { useDebts, buildDebtName, type Debt } from '@/entities/debt';
import { transactionsApi } from '@/entities/transaction';
import { toLocalISODate, getTodayISO, calendarDateToIso } from '@/shared/lib/date';
import type { Transaction } from '@/shared/api/database.types';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';

export interface EditDebtFormData {
  person_name: string;
  total_amount: number;
  description: string;
  is_private: boolean;
  /** Дата долга, YYYY-MM-DD в локальной зоне — в таком виде её отдаёт календарь. */
  created_at: string;
}

/**
 * Собирает метку времени из выбранной даты и времени исходной записи. Время
 * сохраняется, потому что долги одного дня выстраиваются в списке по нему.
 */
function withPickedDate(originalIso: string, picked: string): string {
  const [year, month, day] = picked.split('-').map(Number);
  const base = new Date(originalIso);
  return new Date(
    year,
    month - 1,
    day,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds(),
  ).toISOString();
}

export function useEditDebt(
  debt: MaybeRefOrGetter<Debt | null>,
  userId: MaybeRefOrGetter<string | null>,
) {
  const { updateDebt } = useDebts(userId);
  const { toast } = useToast();
  const { trigger } = useHaptics();

  const initial = makeFormData(toValue(debt));
  const formData = ref<EditDebtFormData>(initial);
  const isSubmitting = ref(false);
  const originalData = ref<EditDebtFormData>({ ...initial });

  function makeFormData(d: Debt | null): EditDebtFormData {
    return {
      person_name: d?.person_name ?? '',
      total_amount: d?.total_amount ?? 0,
      description: d?.description ?? '',
      is_private: d?.is_private ?? false,
      created_at: d ? toLocalISODate(new Date(d.created_at)) : getTodayISO(),
    };
  }

  // Re-init when debt changes (not immediate — initial values set above)
  watch(
    () => toValue(debt),
    (d) => {
      if (d) {
        const data = makeFormData(d);
        formData.value = data;
        originalData.value = { ...data };
      }
    },
  );

  const isValid = computed(() => {
    return (
      formData.value.person_name.trim().length > 0 &&
      formData.value.total_amount > 0 &&
      formData.value.created_at.length > 0
    );
  });

  const isDirty = computed(() => {
    return JSON.stringify(formData.value) !== JSON.stringify(originalData.value);
  });

  const warnings = computed(() => {
    const result: string[] = [];
    const d = toValue(debt);
    if (!d?.transaction_id) return result;
    if (formData.value.total_amount !== originalData.value.total_amount) {
      result.push('Сумма связанной транзакции тоже будет обновлена');
    }
    if (formData.value.created_at !== originalData.value.created_at) {
      result.push('Дата связанной транзакции тоже будет обновлена');
    }
    return result;
  });

  function updateField<K extends keyof EditDebtFormData>(field: K, value: EditDebtFormData[K]) {
    formData.value[field] = value;
  }

  async function submit(): Promise<boolean> {
    const d = toValue(debt);
    if (!d || !isValid.value || !isDirty.value) return false;

    isSubmitting.value = true;
    try {
      const updates: Partial<Debt> = {};
      const f = formData.value;
      const o = originalData.value;

      if (f.person_name !== o.person_name) {
        updates.person_name = f.person_name;
        updates.name = buildDebtName(d.debt_type as 'given' | 'taken', f.person_name);
      }
      if (f.total_amount !== o.total_amount) {
        updates.total_amount = f.total_amount;
        // Adjust remaining by the same delta to preserve paid amount
        const delta = f.total_amount - o.total_amount;
        updates.remaining_amount = Math.max(0, d.remaining_amount + delta);
      }
      if (f.description !== o.description) updates.description = f.description || null;
      if (f.is_private !== o.is_private) updates.is_private = f.is_private;
      if (f.created_at !== o.created_at) {
        updates.created_at = withPickedDate(d.created_at, f.created_at);
      }

      // Сумма и дата едут в транзакцию создания одним патчем — менять их могли
      // за одно редактирование.
      const transactionPatch: Partial<Transaction> = {};
      if (updates.total_amount !== undefined) transactionPatch.amount = updates.total_amount;
      if (f.created_at !== o.created_at) transactionPatch.date = calendarDateToIso(f.created_at);

      await updateDebt(d.id, updates);

      // Update linked creation transaction and force-refetch caches
      if (Object.keys(transactionPatch).length > 0 && d.transaction_id) {
        const uid = toValue(userId);
        await transactionsApi.update(d.transaction_id, transactionPatch);
        if (uid) {
          // Use refetchQueries to force immediate data refresh (not just mark stale)
          await Promise.all([
            invalidateTransactionRelated(queryClient, uid),
            invalidateAccountRelated(queryClient, uid),
          ]);
          // Force refetch active queries so UI updates immediately
          await queryClient.refetchQueries({ type: 'active' });
        }
      }
      trigger('success');
      toast({ title: 'Долг обновлён' });
      return true;
    } catch {
      toast({ title: 'Не удалось обновить долг', variant: 'error' });
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  function reset() {
    const d = makeFormData(toValue(debt));
    formData.value = d;
    originalData.value = { ...d };
  }

  return {
    formData,
    isValid,
    isDirty,
    isSubmitting,
    warnings,
    updateField,
    submit,
    reset,
  };
}
