import {
  computed,
  inject,
  provide,
  ref,
  toValue,
  type InjectionKey,
  type MaybeRefOrGetter,
} from 'vue';
import { useAccounts } from '@/entities/account';
import {
  findClosingRecords,
  maskDebtName,
  useDebtMutations,
  useDebtTransactions,
  type Debt,
} from '@/entities/debt';
import { useDeleteDebt } from '@/features/delete-debt';
import { useReopenDebt } from '@/features/reopen-debt';
import { useDebtPaymentFlow } from '@/features/pay-debt';
import { useDebtShare } from '@/features/share-debts';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';
import { useToast } from '@/shared/ui';

export interface UseDebtDetailOptions {
  /** Сам долг, а не его id: и страница, и панель уже держат его в руках. */
  debt: MaybeRefOrGetter<Debt | null>;
  /** Долг ещё грузится — у панели списка он уже есть, у страницы нет. */
  isLoading?: MaybeRefOrGetter<boolean>;
  /** Долг ушёл с экрана: закрыт платежом или удалён. */
  onGone?: () => void;
}

export type DebtDetail = ReturnType<typeof useDebtDetail>;

const DEBT_DETAIL_KEY: InjectionKey<DebtDetail> = Symbol('debt-detail');

/**
 * Всё, что можно сделать с одним долгом, — в одном месте.
 *
 * Экран долга и десктопная панель списка отличаются только рамкой вокруг: у
 * одной шапка приложения, у другой строка с именем. Действия же (платёж,
 * правка, удаление, отмена закрытия, шаринг, приватность) раньше стояли двумя
 * почти одинаковыми наборами обработчиков, и любая правка одного набора молча
 * расходилась со вторым.
 *
 * Композабл заодно раздаёт себя вниз по дереву: шторки и тело экрана берут его
 * через `useDebtDetailContext()` и не тянут за собой проп-цепочку.
 */
export function useDebtDetail(options: UseDebtDetailOptions) {
  const { debt, onGone } = options;
  const { userId } = useCurrentUser();
  const { trigger } = useHaptics();
  const { toast } = useToast();
  const { accounts } = useAccounts(userId);
  const { updateDebt } = useDebtMutations(userId);

  const debtId = computed(() => toValue(debt)?.id ?? null);
  const { transactions, isLoading: transactionsLoading } = useDebtTransactions(debtId);

  const isLoading = computed(() => toValue(options.isLoading) ?? false);
  const title = computed(() => {
    const value = toValue(debt);
    return value ? maskDebtName(value) : 'Долг';
  });
  const currency = computed(() => toValue(debt)?.currency || DEFAULT_CURRENCY);
  const closingRecords = computed(() => findClosingRecords(toValue(debt), transactions.value));

  const isActionsOpen = ref(false);
  const isEditOpen = ref(false);
  const isDeleteOpen = ref(false);
  const isReopenOpen = ref(false);

  const { isDeleting, deleteDebt } = useDeleteDebt();
  const { isReopening, reopenDebt } = useReopenDebt();
  const {
    isOpen: isPaymentOpen,
    draft: paymentDraft,
    open: openPayment,
    submit: submitPayment,
  } = useDebtPaymentFlow({ userId, debt, onClosed: () => onGone?.() });
  const {
    isOpen: isShareOpen,
    payload: sharePayload,
    open: openShare,
  } = useDebtShare(userId, debt);

  function openActions() {
    trigger('selection');
    isActionsOpen.value = true;
  }

  function openEdit() {
    trigger('selection');
    isEditOpen.value = true;
  }

  function askDelete() {
    isDeleteOpen.value = true;
  }

  function askReopen() {
    isReopenOpen.value = true;
  }

  async function confirmDelete() {
    const value = toValue(debt);
    if (!value || !userId.value) return;
    if (await deleteDebt(value, userId.value)) {
      // Отклик по факту ответа сервера, а не по нажатию: обе операции могут
      // не пройти, и вибрация «получилось» до ответа была бы враньём.
      trigger('success');
      isDeleteOpen.value = false;
      onGone?.();
    }
  }

  async function confirmReopen() {
    const value = toValue(debt);
    if (!value || !userId.value) return;
    if (await reopenDebt(value.id, userId.value)) {
      trigger('success');
      isReopenOpen.value = false;
    }
  }

  async function togglePrivate(value: boolean) {
    const current = toValue(debt);
    if (!current) return;
    try {
      await updateDebt(current.id, { is_private: value });
    } catch {
      // Оптимистичный патч кэша откатывает сама мутация — здесь только тост.
      toast({ title: 'Не удалось обновить', variant: 'error' });
    }
  }

  const api = {
    debt: computed(() => toValue(debt)),
    isLoading,
    title,
    currency,
    accounts,
    transactions,
    transactionsLoading,
    closingRecords,

    isActionsOpen,
    isEditOpen,
    isDeleteOpen,
    isReopenOpen,
    isPaymentOpen,
    isShareOpen,
    paymentDraft,
    sharePayload,
    isDeleting,
    isReopening,

    openActions,
    openEdit,
    openPayment,
    openShare,
    askDelete,
    askReopen,
    confirmDelete,
    confirmReopen,
    submitPayment,
    togglePrivate,
  };

  provide(DEBT_DETAIL_KEY, api);

  return api;
}

export function useDebtDetailContext(): DebtDetail {
  const api = inject(DEBT_DETAIL_KEY);
  if (!api) throw new Error('useDebtDetailContext: выше по дереву нет useDebtDetail');
  return api;
}
