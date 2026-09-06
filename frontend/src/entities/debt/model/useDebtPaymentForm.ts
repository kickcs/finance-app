import { ref, computed, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { CATEGORY_IDS } from '@/shared/config/categoryIds';

export function useDebtPaymentForm(options: {
  remainingAmount: MaybeRefOrGetter<number>;
  debtType: MaybeRefOrGetter<'given' | 'taken'>;
}) {
  const paymentAmount = ref(0);
  const forgiveRemainder = ref(false);
  const excessCategoryId = ref<string>(CATEGORY_IDS.GIFTS_INCOME);
  /** Долг закрывают работой, а не деньгами. */
  const settleWithWork = ref(false);
  const workNote = ref('');

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
    if (!byWork) workNote.value = '';
  });

  function reset(amount?: number) {
    paymentAmount.value = amount ?? toValue(options.remainingAmount);
    forgiveRemainder.value = false;
    settleWithWork.value = false;
    workNote.value = '';
    excessCategoryId.value =
      toValue(options.debtType) === 'given' ? CATEGORY_IDS.GIFTS_INCOME : CATEGORY_IDS.GIFTS;
  }

  return {
    paymentAmount,
    forgiveRemainder,
    excessCategoryId,
    settleWithWork,
    workNote,
    isOverpayment,
    excess,
    remainder,
    reset,
  };
}
