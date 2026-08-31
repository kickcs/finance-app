import { ref, computed, watch, type MaybeRefOrGetter, toValue } from 'vue';
import {
  useDebtMutations,
  buildDebtName,
  getDebtSplit,
  type Debt,
  type DebtDirection,
} from '@/entities/debt';
import { CATEGORY_IDS } from '@/entities/category';
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
  next_payment_date: string | null;
  account_id: string | null;
  debt_type: DebtDirection;
}

/**
 * Сколько по долгу уже вернули. Пока хоть что-то возвращено, направление
 * менять нельзя: платежи лежат в своих категориях возврата, и переворот долга
 * оставил бы их указывать в обратную сторону.
 */
function paidAmount(debt: Debt): number {
  return getDebtSplit(debt).paid;
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
  const { updateDebt } = useDebtMutations(userId);
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
      next_payment_date: d?.next_payment_date ?? null,
      account_id: d?.account_id ?? null,
      debt_type: (d?.debt_type as DebtDirection) ?? 'taken',
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
      formData.value.created_at.length > 0 &&
      // Счёт нельзя обнулить у долга, за которым стоит операция: ей некуда
      // будет лечь.
      (formData.value.account_id !== null || !toValue(debt)?.transaction_id)
    );
  });

  const canChangeDirection = computed(() => {
    const d = toValue(debt);
    return !!d && paidAmount(d) === 0;
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
    if (formData.value.account_id !== originalData.value.account_id) {
      result.push('Операция переедет на выбранный счёт, балансы обоих пересчитаются');
    }
    if (formData.value.debt_type !== originalData.value.debt_type) {
      result.push('Операция сменит направление: расход станет доходом или наоборот');
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
    let transactionSaved = false;
    try {
      const updates: Partial<Debt> = {};
      const f = formData.value;
      const o = originalData.value;

      // Направление переворачивается только у долга, по которому ещё ничего не
      // возвращали, — иначе платежи остались бы в категориях обратной стороны.
      const nextType = canChangeDirection.value ? f.debt_type : o.debt_type;
      const directionChanged = nextType !== o.debt_type;

      if (f.person_name !== o.person_name) updates.person_name = f.person_name;
      // Имя собирается из направления и человека, поэтому его пересобирает
      // любое из двух изменений.
      if (f.person_name !== o.person_name || directionChanged) {
        updates.name = buildDebtName(nextType, f.person_name);
      }
      if (directionChanged) updates.debt_type = nextType;
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
      if (f.next_payment_date !== o.next_payment_date) {
        updates.next_payment_date = f.next_payment_date;
      }
      if (f.account_id !== o.account_id) updates.account_id = f.account_id;

      // Всё, что долг делит со своей операцией создания, едет одним патчем:
      // за одно редактирование могли изменить и сумму, и счёт, и направление.
      const transactionPatch: Partial<Transaction> = {};
      if (updates.total_amount !== undefined) transactionPatch.amount = updates.total_amount;
      if (f.created_at !== o.created_at) transactionPatch.date = calendarDateToIso(f.created_at);
      if (f.account_id !== o.account_id && f.account_id) transactionPatch.account_id = f.account_id;
      if (directionChanged) {
        // «Дал» — деньги ушли со счёта, «взял» — пришли. Категория идёт следом:
        // по ней операция опознаётся как долговая в истории и аналитике.
        transactionPatch.type = nextType === 'given' ? 'expense' : 'income';
        transactionPatch.category_id =
          nextType === 'given' ? CATEGORY_IDS.DEBT_GIVEN : CATEGORY_IDS.DEBT_TAKEN;
      }

      // Сначала операция, потом долг. Оборвётся посередине — долг останется
      // прежним, форма грязной, и повтор доведёт дело до конца. Обратный
      // порядок оставил бы долг «взял» поверх расхода по счёту, а такое из
      // интерфейса уже не починить.
      const uid = toValue(userId);
      const transactionId = Object.keys(transactionPatch).length > 0 ? d.transaction_id : null;

      if (transactionId) {
        await transactionsApi.update(transactionId, transactionPatch);
        transactionSaved = true;
        if (uid) {
          await Promise.all([
            invalidateTransactionRelated(queryClient, uid),
            invalidateAccountRelated(queryClient, uid),
          ]);
        }
      }

      await updateDebt(d.id, updates);

      // Инвалидация только метит кэш устаревшим — баланс на экране должен
      // смениться сразу, поэтому активные запросы дёргаем принудительно.
      if (transactionId && uid) await queryClient.refetchQueries({ type: 'active' });

      trigger('success');
      toast({ title: 'Долг обновлён' });
      return true;
    } catch {
      // Операция могла уже уехать — молчать об этом нельзя, иначе долг и
      // история разойдутся незаметно.
      toast({
        title: transactionSaved
          ? 'Долг не обновлён, но операция уже изменена'
          : 'Не удалось обновить долг',
        variant: 'error',
      });
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
    canChangeDirection,
    isSubmitting,
    warnings,
    updateField,
    submit,
    reset,
  };
}
