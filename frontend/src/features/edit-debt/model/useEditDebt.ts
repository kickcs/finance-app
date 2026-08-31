import { computed, ref, type MaybeRefOrGetter, toValue } from 'vue';
import {
  useDebtMutations,
  useDebtFormModel,
  buildDebtName,
  debtCategoryId,
  debtTransactionType,
  getDebtSplit,
  type Debt,
  type DebtFormFields,
  type DebtUpdate,
} from '@/entities/debt';
import { transactionsApi } from '@/entities/transaction';
import { toLocalISODate, calendarDateToIso } from '@/shared/lib/date';
import type { Transaction } from '@/shared/api/database.types';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';

/** Долг в поля формы. Обратный ход — в `submit`. */
function toFormFields(d: Debt | null): Partial<DebtFormFields> | null {
  if (!d) return null;
  return {
    debt_type: d.debt_type,
    person_name: d.person_name ?? '',
    amount: d.total_amount,
    currency: d.currency,
    account_id: d.account_id,
    date: toLocalISODate(new Date(d.created_at)),
    due_date: d.next_payment_date,
    description: d.description ?? '',
    is_private: d.is_private,
    fee: d.fee_amount,
    // Долг без операции создания деньгами не двигал — комиссии у него нет.
    skip_transaction: !d.transaction_id,
  };
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

  const { fields, original, isValid, isDirty, changed, updateField, reset } = useDebtFormModel({
    initial: () => toFormFields(toValue(debt)),
    // Счёт нельзя обнулить у долга, за которым стоит операция: ей некуда лечь.
    requiresAccount: () => !!toValue(debt)?.transaction_id,
  });

  const isSubmitting = ref(false);

  /**
   * Направление задаёт категории платежей возврата. Перевернуть долг, по
   * которому уже возвращали, значит развернуть их в обратную сторону.
   */
  const canChangeDirection = computed(() => {
    const d = toValue(debt);
    return !!d && getDebtSplit(d).paid === 0;
  });

  /**
   * Комиссию правит расходная запись за ней. У долгов, заведённых до этой
   * связи, её нет — там комиссия остаётся такой, какой была.
   */
  const canChangeFee = computed(() => {
    const d = toValue(debt);
    return !!d && !!d.transaction_id && (d.fee_amount === 0 || !!d.fee_transaction_id);
  });

  const warnings = computed(() => {
    const result: string[] = [];
    const d = toValue(debt);
    if (!d?.transaction_id) return result;
    const c = changed.value;
    if (c.amount !== undefined) result.push('Сумма связанной транзакции тоже будет обновлена');
    if (c.date !== undefined) result.push('Дата связанной транзакции тоже будет обновлена');
    if (c.account_id !== undefined) {
      result.push('Операция переедет на выбранный счёт, балансы обоих пересчитаются');
    }
    if (c.debt_type !== undefined) {
      result.push('Операция сменит направление: расход станет доходом или наоборот');
    }
    return result;
  });

  async function submit(): Promise<boolean> {
    const d = toValue(debt);
    if (!d || !isValid.value || !isDirty.value) return false;

    isSubmitting.value = true;
    let transactionSaved = false;
    try {
      const f = fields.value;
      const c = changed.value;
      const updates: DebtUpdate = {};

      const nextType = canChangeDirection.value ? f.debt_type : original.value.debt_type;
      const directionChanged = nextType !== original.value.debt_type;

      if (c.person_name !== undefined) updates.person_name = f.person_name;
      // Имя собирается из направления и человека, поэтому его пересобирает
      // любое из двух изменений.
      if (c.person_name !== undefined || directionChanged) {
        updates.name = buildDebtName(nextType, f.person_name);
      }
      if (directionChanged) updates.debt_type = nextType;
      // Остаток за суммой двигает сервер: правило «возвращённое остаётся
      // возвращённым» одно на всех, и клиенту его знать незачем.
      if (c.amount !== undefined) updates.total_amount = f.amount;
      if (c.description !== undefined) updates.description = f.description || null;
      if (c.is_private !== undefined) updates.is_private = f.is_private;
      if (c.date !== undefined && f.date) {
        updates.created_at = withPickedDate(d.created_at, f.date);
      }
      if (c.due_date !== undefined) updates.next_payment_date = f.due_date;
      if (c.account_id !== undefined) updates.account_id = f.account_id;
      // Комиссию правит сервер: он же двигает её расходную запись.
      if (c.fee !== undefined && canChangeFee.value) updates.fee_amount = f.fee;

      // Всё, что долг делит со своей операцией создания, едет одним патчем:
      // за одно редактирование могли изменить и сумму, и счёт, и направление.
      const transactionPatch: Partial<Transaction> = {};
      if (updates.total_amount !== undefined) transactionPatch.amount = updates.total_amount;
      if (c.date !== undefined && f.date) transactionPatch.date = calendarDateToIso(f.date);
      if (c.account_id !== undefined && f.account_id) transactionPatch.account_id = f.account_id;
      if (directionChanged) {
        // «Дал» — деньги ушли со счёта, «взял» — пришли. Категория идёт следом:
        // по ней операция опознаётся как долговая в истории и аналитике.
        transactionPatch.type = debtTransactionType(nextType);
        transactionPatch.category_id = debtCategoryId(nextType);
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
      if ((transactionId || updates.fee_amount !== undefined) && uid) {
        await queryClient.refetchQueries({ type: 'active' });
      }

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

  return {
    formData: fields,
    isValid,
    isDirty,
    canChangeDirection,
    canChangeFee,
    isSubmitting,
    warnings,
    updateField,
    submit,
    reset,
  };
}
