import { ref, computed, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { useDebts, type Debt } from '@/entities/debt';
import { transactionsApi } from '@/entities/transaction';
import { useToast } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';

export interface EditDebtFormData {
  person_name: string;
  total_amount: number;
  description: string;
  is_private: boolean;
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
    return formData.value.person_name.trim().length > 0 && formData.value.total_amount > 0;
  });

  const isDirty = computed(() => {
    return JSON.stringify(formData.value) !== JSON.stringify(originalData.value);
  });

  const warnings = computed(() => {
    const result: string[] = [];
    const d = toValue(debt);
    if (formData.value.total_amount !== originalData.value.total_amount) {
      if (d?.transaction_id) {
        result.push('Сумма связанной транзакции тоже будет обновлена');
      }
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

      if (f.person_name !== o.person_name) updates.person_name = f.person_name;
      if (f.total_amount !== o.total_amount) updates.total_amount = f.total_amount;
      if (f.description !== o.description) updates.description = f.description || null;
      if (f.is_private !== o.is_private) updates.is_private = f.is_private;

      await updateDebt(d.id, updates);

      // Update linked creation transaction amount if debt amount changed
      if (updates.total_amount !== undefined && d.transaction_id) {
        await transactionsApi.update(d.transaction_id, { amount: updates.total_amount });
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
