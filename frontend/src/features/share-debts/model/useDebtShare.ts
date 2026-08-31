import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue';
import { getDebtDisplayName, type Debt } from '@/entities/debt';
import { useExchangeRates, useProfile } from '@/shared/api';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { buildSharePayload } from './buildSharePayload';

/**
 * Шаринг с экрана одного долга.
 *
 * До этого поделиться можно было только из списка, отфильтрованного по
 * человеку, а человек с единственным долгом в этот список не попадает — тап по
 * нему уходит сразу в карточку долга. Кнопки не было там, где она нужнее всего.
 *
 * В снимок идёт ровно этот долг, а не все долги человека: правило то же, что и
 * в списке — уходит то, что отправитель видит на экране, иначе получателю
 * достанется то, чего отправитель не показывал.
 */
export function useDebtShare(
  userId: MaybeRefOrGetter<string | null>,
  debt: MaybeRefOrGetter<Debt | null>,
) {
  const { currency } = useUserCurrency();
  const { convert } = useExchangeRates(currency);
  const { profile } = useProfile(userId);

  const isOpen = ref(false);

  /** Закрытым делиться нечем, приватный из снимка всё равно выпадет. */
  const canShare = computed(() => {
    const value = toValue(debt);
    return !!value && !value.is_closed && !value.is_private;
  });

  const payload = computed(() => {
    const value = toValue(debt);
    if (!value) return null;

    return buildSharePayload({
      personName: getDebtDisplayName(value),
      currency: currency.value,
      debts: [value],
      ownerName: profile.value?.name ?? null,
      convert,
    });
  });

  function open() {
    if (canShare.value) isOpen.value = true;
  }

  return { isOpen, canShare, payload, open };
}
