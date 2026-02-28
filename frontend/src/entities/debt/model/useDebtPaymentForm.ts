import { ref, computed, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { CATEGORY_IDS } from '@/shared/config/categoryIds';

export function useDebtPaymentForm(options: {
  remainingAmount: MaybeRefOrGetter<number>;
  debtType: MaybeRefOrGetter<'given' | 'taken'>;
}) {
  const paymentAmount = ref(0);
  const forgiveRemainder = ref(false);
  const excessCategoryId = ref<string>(CATEGORY_IDS.GIFTS_INCOME);

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

  function reset(amount?: number) {
    paymentAmount.value = amount ?? toValue(options.remainingAmount);
    forgiveRemainder.value = false;
    excessCategoryId.value =
      toValue(options.debtType) === 'given' ? CATEGORY_IDS.GIFTS_INCOME : CATEGORY_IDS.GIFTS;
  }

  return {
    paymentAmount,
    forgiveRemainder,
    excessCategoryId,
    isOverpayment,
    excess,
    remainder,
    reset,
  };
}
