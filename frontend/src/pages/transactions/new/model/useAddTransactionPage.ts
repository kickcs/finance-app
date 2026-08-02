import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTransactionForm, useSubmitTransaction } from '@/features/add-transaction';
import { useAccounts } from '@/entities/account';
import { useCategories } from '@/entities/category';
import { useProfile } from '@/shared/api';
import { useSplitExpense } from '@/features/split-expense';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';

interface AddTransactionPageOptions {
  /**
   * Куда уходить после успешного сохранения. Мобильная страница возвращается
   * назад с анимацией слайда, десктопная модалка просто закрывается — это
   * единственное, чем платформы здесь расходятся.
   */
  onDone: () => void;
}

/**
 * Вся начинка экрана «Новая операция», общая для мобильной страницы и
 * десктопной модалки: запросы, предзаполнение из query, автовыбор счёта,
 * разделение расхода и отправка.
 *
 * Держать это в самих SFC нельзя: разметка у платформ разная, а логика — одна,
 * и продублированная она разъезжается при первой же правке.
 */
export function useAddTransactionPage({ onDone }: AddTransactionPageOptions) {
  const route = useRoute();
  const { userId } = useCurrentUser();

  const { accounts, isLoading: accountsLoading } = useAccounts(userId);
  const { expenseCategories, incomeCategories } = useCategories(userId);
  const { defaultAccountId } = useProfile(userId);
  const { currency: userCurrency } = useUserCurrency();

  const { formData, isValid, setType, updateField } = useTransactionForm();
  const { isSubmitting, submit, submitAndWait, rollbackTransaction } = useSubmitTransaction();

  // Локальная ошибка валидации — отдельно от ошибки мутации, та уходит в тост.
  const validationError = ref<string | null>(null);

  const {
    splitData,
    isValid: splitIsValid,
    validationError: splitValidationError,
    addParticipant,
    removeParticipant,
    updateParticipantAmount,
    setMethod: setSplitMethod,
    setMyShare,
    setIsIncluded,
    setEnabled: setSplitEnabled,
    createDebtsForSplit,
    reset: resetSplit,
  } = useSplitExpense(() => formData.value.amount);

  onMounted(() => {
    // Разделение расхода живёт в синглтоне — при входе на экран его состояние
    // от прошлого раза надо сбросить.
    resetSplit();

    const typeParam = route.query.type as string;
    if (
      typeParam === 'income' ||
      typeParam === 'expense' ||
      typeParam === 'transfer' ||
      typeParam === 'debt'
    ) {
      setType(typeParam);
    }

    // Предзаполнение категории из быстрого действия.
    const categoryId = route.query.categoryId as string;
    if (categoryId) {
      updateField('categoryId', categoryId);
    }
  });

  // Счёт подставляется, как только счета загрузились: query > счёт по умолчанию > первый.
  watch(
    [accounts, defaultAccountId],
    ([accs, defaultId]) => {
      if (accs.length > 0 && !formData.value.accountId) {
        const queryAccountId = route.query.accountId as string;
        const queryAccount = queryAccountId ? accs.find((a) => a.id === queryAccountId) : null;

        const selectedId = queryAccount
          ? queryAccountId
          : defaultId && accs.some((a) => a.id === defaultId)
            ? defaultId
            : accs[0].id;

        const selectedAccount = accs.find((a) => a.id === selectedId);
        if (selectedAccount && selectedAccount.balances.length > 0) {
          updateField('accountId', selectedId);
          updateField('currency', selectedAccount.balances[0].currency);
        }
      }
    },
    { immediate: true },
  );

  async function handleSplitSubmit(uid: string): Promise<boolean> {
    if (!formData.value.accountId) {
      validationError.value = 'Выберите счёт для транзакции';
      return false;
    }

    const transactionId = await submitAndWait(uid, formData.value);
    if (!transactionId) return false;

    const success = await createDebtsForSplit(
      transactionId,
      uid,
      formData.value.accountId,
      formData.value.currency,
      formData.value.date,
    );

    if (!success) {
      const rolledBack = await rollbackTransaction(transactionId, uid);
      validationError.value = rolledBack
        ? 'Не удалось создать долги для раздельного счёта. Операция отменена.'
        : 'Не удалось создать часть долгов. Транзакция сохранена — проверьте её в истории.';
      return false;
    }

    return true;
  }

  async function handleSubmit() {
    // Защита от второго нажатия до того, как первое отработало: иначе создаются
    // две одинаковые операции.
    if (isSubmitting.value) return;

    validationError.value = null;

    if (formData.value.type === 'debt') {
      // Панель долга владеет своей отправкой и сама поднимает `debt-submitted`.
      return;
    }

    if (!userId.value) {
      validationError.value = 'Пользователь не авторизован';
      return;
    }

    if (splitData.value.enabled && !splitIsValid.value) {
      validationError.value = splitValidationError.value || 'Проверьте данные разделения расхода';
      return;
    }

    const isSplit = splitData.value.enabled && splitData.value.participants.length > 0;

    if (isSplit) {
      if (!(await handleSplitSubmit(userId.value))) return;
    } else {
      submit(userId.value, formData.value);
    }

    resetSplit();
    onDone();
  }

  return {
    accounts,
    accountsLoading,
    expenseCategories,
    incomeCategories,
    defaultAccountId,
    userCurrency,
    formData,
    isValid,
    isSubmitting,
    validationError,
    splitData,
    splitValidationError,
    addParticipant,
    removeParticipant,
    updateParticipantAmount,
    setSplitMethod,
    setMyShare,
    setIsIncluded,
    setSplitEnabled,
    handleSubmit,
  };
}
