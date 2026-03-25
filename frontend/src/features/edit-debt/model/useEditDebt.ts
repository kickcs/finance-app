import { ref, computed, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { useDebts, buildDebtName, type Debt, type DebtDirection } from '@/entities/debt';
import { useToast } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';

export interface EditDebtFormData {
  debt_type: DebtDirection;
  person_name: string;
  total_amount: number;
  remaining_amount: number;
  account_id: string | null;
  monthly_payment: number | null;
  next_payment_date: string | null;
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
      debt_type: (d?.debt_type as DebtDirection) ?? 'taken',
      person_name: d?.person_name ?? '',
      total_amount: d?.total_amount ?? 0,
      remaining_amount: d?.remaining_amount ?? 0,
      account_id: d?.account_id ?? null,
      monthly_payment: d?.monthly_payment ?? null,
      next_payment_date: d?.next_payment_date ?? null,
      description: d?.description ?? '',
      is_private: d?.is_private ?? false,
    };
  }

  // Re-init when debt changes
  watch(
    () => toValue(debt),
    (d) => {
      if (d) {
        formData.value = makeFormData(d);
        originalData.value = makeFormData(d);
      }
    },
    { immediate: true },
  );

  const isValid = computed(() => {
    return (
      formData.value.person_name.trim().length > 0 &&
      formData.value.total_amount > 0 &&
      formData.value.remaining_amount >= 0 &&
      formData.value.remaining_amount <= formData.value.total_amount
    );
  });

  const isDirty = computed(() => {
    return JSON.stringify(formData.value) !== JSON.stringify(originalData.value);
  });

  const warnings = computed(() => {
    const result: string[] = [];
    if (formData.value.total_amount !== originalData.value.total_amount) {
      result.push('Изменение суммы не повлияет на уже созданные транзакции платежей');
    }
    if (formData.value.debt_type !== originalData.value.debt_type) {
      result.push('Направление долга изменится');
    }
    return result;
  });

  function updateField<K extends keyof EditDebtFormData>(field: K, value: EditDebtFormData[K]) {
    formData.value[field] = value;

    // Auto-correct remaining if exceeds total
    if (field === 'total_amount' && formData.value.remaining_amount > formData.value.total_amount) {
      formData.value.remaining_amount = formData.value.total_amount;
    }
  }

  async function submit(): Promise<boolean> {
    const d = toValue(debt);
    if (!d || !isValid.value || !isDirty.value) return false;

    isSubmitting.value = true;
    try {
      // Build diff — only send changed fields
      const updates: Partial<Debt> = {};
      const f = formData.value;
      const o = originalData.value;

      if (f.debt_type !== o.debt_type) updates.debt_type = f.debt_type;
      if (f.person_name !== o.person_name) updates.person_name = f.person_name;
      if (f.total_amount !== o.total_amount) updates.total_amount = f.total_amount;
      if (f.remaining_amount !== o.remaining_amount) updates.remaining_amount = f.remaining_amount;
      if (f.account_id !== o.account_id) updates.account_id = f.account_id;
      if (f.monthly_payment !== o.monthly_payment) updates.monthly_payment = f.monthly_payment;
      if (f.next_payment_date !== o.next_payment_date)
        updates.next_payment_date = f.next_payment_date;
      if (f.description !== o.description) updates.description = f.description || null;
      if (f.is_private !== o.is_private) updates.is_private = f.is_private;

      // Also update the name if person_name or debt_type changed
      if (updates.person_name !== undefined || updates.debt_type !== undefined) {
        updates.name = buildDebtName(f.debt_type, f.person_name);
      }

      await updateDebt(d.id, updates);
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
