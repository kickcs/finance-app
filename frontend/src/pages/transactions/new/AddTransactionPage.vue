<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { UButton, UIcon } from '@/shared/ui';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { AppHeader } from '@/widgets/header';
import {
  TransactionForm,
  useTransactionForm,
  useSubmitTransaction,
} from '@/features/add-transaction';
import { useAccounts } from '@/entities/account';
import { useCategories } from '@/entities/category';
import { useProfile } from '@/shared/api';
import { navigateBack, navigateBackTo, isPageTransitioning } from '@/app/router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useSplitExpense } from '@/features/split-expense';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';

const router = useRouter();
const route = useRoute();
const { userId } = useCurrentUser();

// Get accounts and categories for the current user
const { accounts, isLoading: accountsLoading } = useAccounts(userId);
const { expenseCategories, incomeCategories } = useCategories(userId);
const { defaultAccountId } = useProfile(userId);
const { currency: userCurrency } = useUserCurrency();

/**
 * Клавиатуру открываем и тяжёлый хвост формы дорисовываем после слайда: во
 * время перехода клавиатура пересчитывает `h-dvh`, а монтирование календаря и
 * vaul-шита съедает те же кадры, в которых страница едет.
 *
 * Защёлка в одну сторону: обратный переход (уход со страницы) снова поднимает
 * флаг, и простой `computed` выдернул бы хвост формы из уже уезжающего экрана —
 * ровно тот дефект, который здесь и лечится.
 */
const isReady = ref(false);
watch(isPageTransitioning, (transitioning) => !transitioning && (isReady.value = true), {
  immediate: true,
});

// Use the add transaction feature
const { formData, isValid, setType, updateField } = useTransactionForm();
const { isSubmitting, submit, submitAndWait, rollbackTransaction } = useSubmitTransaction();

// Local validation error (separate from mutation error which is handled via toast)
const validationError = ref<string | null>(null);

// Use split expense feature
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

// Set transaction type from query parameter and reset split data
onMounted(() => {
  // Always reset split data when entering the page
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

  // Pre-fill category from quick action preset
  const categoryId = route.query.categoryId as string;
  if (categoryId) {
    updateField('categoryId', categoryId);
  }
});

// Auto-select default account when accounts load
watch(
  [accounts, defaultAccountId],
  ([accs, defaultId]) => {
    if (accs.length > 0 && !formData.value.accountId) {
      // Check for query param override first
      const queryAccountId = route.query.accountId as string;
      const queryAccount = queryAccountId ? accs.find((a) => a.id === queryAccountId) : null;

      // Use query param > default account > first account
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

/**
 * На этом экране нижняя навигация скрыта (сфокусированный поток), поэтому
 * тупик «зашёл по прямой ссылке — истории нет — кнопка «назад» ничего не
 * делает» больше нечем спасти. Уходим на дашборд.
 */
function goBack() {
  if (window.history.state?.back) {
    navigateBack();
  } else {
    // `navigateBackTo` — тот же replace, но с анимацией «назад»; голый
    // `router.replace` уехал бы вперёд.
    navigateBackTo({ name: ROUTE_NAMES.DASHBOARD });
  }
}

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
  // Double-tap guard: a second tap before the first submit settles would
  // create a duplicate transaction.
  if (isSubmitting.value) return;

  validationError.value = null;

  if (formData.value.type === 'debt') {
    // DebtPanel owns its own submit flow and emits `debt-submitted`.
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
  goBack();
}
</script>

<template>
  <div class="flex h-full min-w-0 flex-col">
    <!-- Шапка одна на все состояния: она же единственный выход с экрана —
         нижняя навигация на этом маршруте скрыта, а в standalone-PWA нет и
         кнопки браузера. -->
    <AppHeader title="Новая транзакция" show-back blur @back="goBack" />

    <main class="flex-1 overflow-y-auto">
      <div class="flex min-h-full flex-col md:mx-auto md:max-w-xl">
        <!-- Пока счета грузятся, форма без счёта выглядит сломанной: пустой
             селектор и заблокированная кнопка. Показываем каркас. -->
        <div
          v-if="accountsLoading && accounts.length === 0"
          class="space-y-3 px-4 pt-1"
          aria-busy="true"
        >
          <Skeleton class="h-28 w-full rounded-2xl" />
          <Skeleton class="h-9 w-full rounded-lg" />
          <Skeleton class="h-16 w-full rounded-xl" />
          <Skeleton class="h-24 w-full rounded-xl" />
        </div>

        <div
          v-else-if="accounts.length === 0"
          data-testid="no-accounts-state"
          class="px-4 py-8 text-center"
        >
          <UIcon
            name="account_balance_wallet"
            size="lg"
            class="mb-3 text-text-tertiary-light dark:text-text-tertiary-dark"
          />
          <p class="mb-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
            У вас пока нет счетов
          </p>
          <UButton
            variant="primary"
            size="sm"
            @click="router.push({ name: ROUTE_NAMES.NEW_ACCOUNT })"
          >
            Создать счёт
          </UButton>
        </div>

        <TransactionForm
          v-else
          v-model:form-data="formData"
          data-testid="transaction-form"
          :accounts="accounts"
          :expense-categories="expenseCategories"
          :income-categories="incomeCategories"
          :user-currency="userCurrency"
          :default-account-id="defaultAccountId"
          :is-submitting="isSubmitting"
          :is-valid="isValid"
          :error="validationError"
          :split-data="splitData"
          :split-validation-error="splitValidationError"
          :autofocus-amount="isReady"
          :ready="isReady"
          @submit="handleSubmit"
          @debt-submitted="goBack"
          @add-participant="addParticipant"
          @remove-participant="removeParticipant"
          @update-participant-amount="updateParticipantAmount"
          @set-split-method="setSplitMethod"
          @set-my-share="setMyShare"
          @set-is-included="setIsIncluded"
          @set-split-enabled="setSplitEnabled"
        />
      </div>
    </main>
  </div>
</template>
