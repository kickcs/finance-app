import { ref, computed, watch, type MaybeRefOrGetter, toValue } from 'vue';
import type { Category } from '@/entities/category';
import { defaultExcessCategoryId } from './debtCategories';

export function useDebtPaymentForm(options: {
  remainingAmount: MaybeRefOrGetter<number>;
  debtType: MaybeRefOrGetter<'given' | 'taken'>;
  /** Категории, из которых выбирают категорию переплаты, — категории пользователя. */
  excessCategories: MaybeRefOrGetter<Category[]>;
}) {
  const paymentAmount = ref(0);
  const forgiveRemainder = ref(false);
  const pickedExcessCategoryId = ref<string | null>(null);
  // Дефолт вычисляется, а не хранится: категории пользователя приходят асинхронно.
  const excessCategoryId = computed({
    get: () =>
      pickedExcessCategoryId.value ??
      defaultExcessCategoryId(toValue(options.debtType), toValue(options.excessCategories)),
    set: (id: string) => {
      pickedExcessCategoryId.value = id;
    },
  });
  /** Долг закрывают работой, а не деньгами. */
  const settleWithWork = ref(false);
  const workNote = ref('');
  /** Категория работы: с ней отработка попадает в аналитику, без неё — только отметка. */
  const workCategoryId = ref<string | null>(null);

  const isOverpayment = computed(() => paymentAmount.value > toValue(options.remainingAmount));
  const excess = computed(() =>
    isOverpayment.value ? paymentAmount.value - toValue(options.remainingAmount) : 0,
  );
  const remainder = computed(() =>
    isOverpayment.value ? 0 : toValue(options.remainingAmount) - paymentAmount.value,
  );

  watch(isOverpayment, (over) => {
    if (over) forgiveRemainder.value = false;
  });

  /**
   * Отработать больше, чем должны, нельзя: переплату деньгами есть куда
   * записать (доход), а лишний труд записывать некуда — сервер такой платёж
   * отклонит, поэтому сумма подрезается на месте, а не в момент отправки.
   */
  watch([settleWithWork, isOverpayment], ([byWork, over]) => {
    if (byWork && over) paymentAmount.value = toValue(options.remainingAmount);
    if (!byWork) {
      workNote.value = '';
      workCategoryId.value = null;
    }
  });

  function reset(amount?: number) {
    paymentAmount.value = amount ?? toValue(options.remainingAmount);
    forgiveRemainder.value = false;
    settleWithWork.value = false;
    workNote.value = '';
    workCategoryId.value = null;
    pickedExcessCategoryId.value = null;
  }

  return {
    paymentAmount,
    forgiveRemainder,
    excessCategoryId,
    settleWithWork,
    workNote,
    workCategoryId,
    isOverpayment,
    excess,
    remainder,
    reset,
  };
}
