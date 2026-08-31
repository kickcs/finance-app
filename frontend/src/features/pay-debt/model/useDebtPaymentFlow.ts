import { ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue';
import { usePayDebt } from './usePayDebt';
import { useHaptics } from '@/shared/lib/haptics';
import type { Debt } from '@/shared/api/database.types';

export interface DebtPaymentSubmit {
  amount: number;
  accountId: string;
  forgiveRemainder?: boolean;
  excessCategoryId?: string;
}

/**
 * Общий поток платежа для списка долгов (десктопная панель) и детальной
 * страницы: отличаются они только тем, что делают после закрытия долга.
 */
export function useDebtPaymentFlow(options: {
  userId: MaybeRefOrGetter<string | null>;
  debt: MaybeRefOrGetter<Debt | null>;
  /** Платёж закрыл долг: детальная страница уходит в список, панель сбрасывает выбор. */
  onClosed?: () => void;
}): {
  isOpen: Ref<boolean>;
  isPaying: Ref<boolean>;
  draft: Ref<DebtPaymentSubmit | null>;
  open: () => void;
  submit: (payload: DebtPaymentSubmit) => Promise<void>;
} {
  const { isPaying, payDebt } = usePayDebt();
  const { trigger } = useHaptics();
  const isOpen = ref(false);
  const draft = ref<DebtPaymentSubmit | null>(null);
  // Черновик принадлежит конкретному долгу: на списке долгов один поток
  // обслуживает любой выбранный долг, и сумма со счётом неудавшегося платежа
  // по одному не должны подставляться в платёж по другому.
  let draftDebtId: string | null = null;

  function clearDraft() {
    draft.value = null;
    draftDebtId = null;
  }

  function open() {
    /**
     * Пока платёж в полёте, шторку не открываем. Она закрывается оптимистично,
     * до ответа сервера, а кэш уже показывает уменьшенный остаток — второй
     * заход подставил бы этот остаток как новую сумму и провёл бы платёж
     * дважды: сервер ещё не видел первый, не долетевший до него платёж.
     */
    if (isPaying.value) return;
    if (draftDebtId !== toValue(options.debt)?.id) clearDraft();
    isOpen.value = true;
  }

  async function submit(payload: DebtPaymentSubmit) {
    const debt = toValue(options.debt);
    const userId = toValue(options.userId);
    if (!debt || !userId) return;

    const willClose = payload.amount >= debt.remaining_amount || !!payload.forgiveRemainder;

    // Кэш уже пропатчен оптимистично внутри payDebt — закрываем
    // шторку сразу, а не держим пользователя перед спиннером четыре
    // последовательных запроса.
    isOpen.value = false;

    const success = await payDebt(debt, payload.amount, payload.accountId, userId, {
      forgiveRemainder: payload.forgiveRemainder,
      excessCategoryId: payload.excessCategoryId,
    });

    if (success) {
      // Гаптика успеха живёт здесь, а не в шторке: та закрывается до ответа
      // сервера и своего перехода isPaying уже не увидит.
      trigger('success');
      clearDraft();
      if (willClose) options.onClosed?.();
    } else {
      // payDebt уже откатил кэш и показал тост об ошибке — открываем
      // шторку заново с введёнными значениями, чтобы их не пришлось набирать.
      draft.value = payload;
      draftDebtId = debt.id;
      isOpen.value = true;
    }
  }

  return {
    isOpen,
    isPaying,
    draft,
    open,
    submit,
  };
}
