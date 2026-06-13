<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { UButton, UIcon, NotFoundState, ConfirmDeleteModal, useToast } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';
import {
  TransactionForm,
  useTransactionForm,
  useSubmitTransaction,
} from '@/features/add-transaction';
import { useSplitExpense } from '@/features/split-expense';
import { useAccounts } from '@/entities/account';
import { useCategories } from '@/entities/category';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { navigateBack } from '@/app/router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { formatRelativeDate } from '@/shared/lib/format/date';
import { useImportedTransactions, type ImportedTransaction } from '@/entities/imported-transaction';

const router = useRouter();
const route = useRoute();
const { userId } = useCurrentUser();
const { toast } = useToast();

const { accounts } = useAccounts(userId);
const { expenseCategories, incomeCategories } = useCategories(userId);
const { currency: userCurrency } = useUserCurrency();

const { items, isLoading, confirmImported, dismissImported } = useImportedTransactions(userId);

// The inbox only ever returns pending items, so a plain find is enough.
const item = computed<ImportedTransaction | null>(
  () => items.value.find((i) => i.id === route.params.id) ?? null,
);

const { formData, isValid, setType, updateField, resetForm } = useTransactionForm();
const { isSubmitting, submitAndWait, rollbackTransaction } = useSubmitTransaction();

// Local validation error (mutation errors surface via toast).
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

// --- Prefill the transaction form from the imported operation ---------------
// Keyed on the item id so a background inbox refetch (same op) never wipes
// in-progress edits — only a genuine switch to another import re-prefills.
let prefilledId: string | null = null;
watch(
  item,
  (current) => {
    if (!current || current.id === prefilledId) return;
    prefilledId = current.id;

    resetForm();
    resetSplit();
    validationError.value = null;

    const absAmount = Math.abs(current.amount ?? 0);

    if (current.type === 'income') {
      setType('income');
      updateField('amount', absAmount);
    } else if (current.type === 'balance_change') {
      // Signed delta: negative → money left the card (expense), otherwise income.
      // Null amount stays 0 so the user types it in manually.
      setType(current.amount !== null && current.amount < 0 ? 'expense' : 'income');
      updateField('amount', absAmount);
    } else {
      setType('expense');
      updateField('amount', absAmount);
    }

    updateField('currency', current.currency);
    updateField('date', new Date(current.occurred_at).getTime());
    updateField('description', current.merchant ?? '');
    if (current.suggested_account_id) {
      updateField('accountId', current.suggested_account_id);
    }
  },
  { immediate: true },
);

// --- Context card presentation ----------------------------------------------
const isBalanceChange = computed(() => item.value?.type === 'balance_change');
const needsManualAmount = computed(() => isBalanceChange.value && item.value?.amount === null);
const relativeDate = computed(() =>
  item.value ? formatRelativeDate(new Date(item.value.occurred_at)) : '',
);

// --- Navigation between pending imports --------------------------------------
function goNextOrBack() {
  const next = items.value.find((i) => i.id !== item.value?.id);
  if (next) {
    router.replace({ name: ROUTE_NAMES.IMPORT_CONFIRM, params: { id: next.id } });
  } else {
    router.replace({ name: ROUTE_NAMES.IMPORT_INBOX });
  }
}

// --- Submit ------------------------------------------------------------------
async function handleSubmit() {
  // Double-tap guard: a second tap before the first settles would duplicate.
  if (isSubmitting.value) return;

  const current = item.value;
  if (!current || !userId.value) return;

  validationError.value = null;

  // Debt has its own submit flow inside DebtPanel (see onDebtSubmitted).
  if (formData.value.type === 'debt') return;

  if (!formData.value.accountId) {
    validationError.value = 'Выберите счёт для транзакции';
    return;
  }

  const isSplit = splitData.value.enabled && splitData.value.participants.length > 0;
  if (isSplit && !splitIsValid.value) {
    validationError.value = splitValidationError.value || 'Проверьте данные разделения расхода';
    return;
  }

  const transactionId = await submitAndWait(userId.value, formData.value);
  if (!transactionId) return; // error already shown by the mutation

  if (isSplit) {
    const success = await createDebtsForSplit(
      transactionId,
      userId.value,
      formData.value.accountId,
      formData.value.currency,
      formData.value.date,
    );
    if (!success) {
      const rolledBack = await rollbackTransaction(transactionId, userId.value);
      validationError.value = rolledBack
        ? 'Не удалось создать долги для раздельного счёта. Операция отменена.'
        : 'Не удалось создать часть долгов. Транзакция сохранена — проверьте её в истории.';
      return;
    }
  }

  try {
    await confirmImported(current.id, {
      transactionId,
      accountId: formData.value.accountId,
      toAccountId:
        formData.value.type === 'transfer' ? (formData.value.toAccountId ?? undefined) : undefined,
    });
  } catch {
    toast({
      title: 'Транзакция создана',
      description: 'Но не удалось отметить импорт подтверждённым. Проверьте инбокс.',
      variant: 'warning',
    });
  }

  resetSplit();
  goNextOrBack();
}

// DebtPanel creates the debt (and its own transaction) itself and does not
// hand back a transactionId, so we cannot mark the import "confirmed" with a
// linked transaction. The import is nonetheless handled — dismiss it from the
// inbox so it stops asking for review.
async function onDebtSubmitted() {
  const current = item.value;
  if (!current) {
    goNextOrBack();
    return;
  }
  try {
    await dismissImported(current.id);
  } catch {
    /* non-fatal: the debt is already created, inbox will refetch later */
  }
  toast({
    title: 'Долг создан',
    description: 'Импорт обработан.',
    variant: 'success',
  });
  goNextOrBack();
}

// --- Dismiss -----------------------------------------------------------------
const showDismissConfirm = ref(false);

async function handleDismiss() {
  const current = item.value;
  showDismissConfirm.value = false;
  if (!current) return;
  await dismissImported(current.id);
  goNextOrBack();
}

// --- Scan receipt ------------------------------------------------------------
function toScanReceipt() {
  const current = item.value;
  if (!current) return;
  router.push({
    name: ROUTE_NAMES.SCAN_RECEIPT,
    query: {
      importedId: current.id,
      expectedAmount: String(Math.abs(current.amount ?? 0)),
    },
  });
}
</script>

<template>
  <div class="h-full flex flex-col min-w-0 relative">
    <!-- Mobile Header -->
    <div class="md:hidden shrink-0">
      <AppHeader title="Подтверждение" show-back blur @back="navigateBack" />
    </div>

    <!-- Desktop Header -->
    <div class="hidden md:flex items-center justify-between px-8 py-6 shrink-0">
      <h1 class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
        Подтверждение импорта
      </h1>
      <button
        type="button"
        aria-label="Закрыть"
        class="w-10 h-10 rounded-full flex items-center justify-center bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors cursor-pointer text-text-secondary-light dark:text-text-secondary-dark"
        @click="navigateBack"
      >
        <UIcon name="close" size="sm" />
      </button>
    </div>

    <!-- Content -->
    <main class="flex-1 overflow-y-auto px-4 md:px-8 pt-2 md:pt-4 pb-12">
      <!-- Not found -->
      <NotFoundState
        v-if="!isLoading && !item"
        icon="inbox"
        message="Импорт не найден"
        action-label="К инбоксу"
        :action-route="ROUTE_NAMES.IMPORT_INBOX"
      />

      <div
        v-else-if="item"
        class="md:max-w-xl md:mx-auto md:bg-card-light md:dark:bg-card-dark md:rounded-3xl md:shadow-sm md:border md:border-border-light md:dark:border-border-dark md:p-8 md:mt-2 space-y-5"
      >
        <!-- Provenance / context card -->
        <section
          class="rounded-2xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden animate-fadeInUp"
        >
          <!-- Source banner -->
          <div class="flex items-center gap-2 px-4 py-2.5 bg-primary-light">
            <UIcon name="telegram" size="xs" class="text-primary" />
            <span class="text-caption font-semibold uppercase tracking-wide text-primary">
              Из Telegram
            </span>
          </div>

          <!-- Card + meta -->
          <div class="flex items-center gap-3 px-4 py-3.5">
            <div
              class="w-11 h-11 rounded-xl bg-surface-light dark:bg-surface-dark flex items-center justify-center shrink-0"
            >
              <UIcon
                name="credit_card"
                size="sm"
                class="text-text-secondary-light dark:text-text-secondary-dark"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p
                class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
              >
                {{ item.merchant || (isBalanceChange ? 'Изменение баланса' : 'Операция по карте') }}
              </p>
              <div
                class="mt-0.5 flex items-center gap-1.5 text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
              >
                <span class="truncate">{{ item.card_mask }}</span>
                <span aria-hidden="true">·</span>
                <span class="shrink-0">{{ relativeDate }}</span>
              </div>
            </div>
          </div>

          <!-- Balance-change explainer -->
          <div
            v-if="isBalanceChange"
            class="mx-4 mb-3.5 flex items-start gap-2 rounded-xl bg-info-light px-3 py-2.5"
          >
            <UIcon name="info" size="xs" class="text-info mt-0.5 shrink-0" />
            <p class="text-xs text-info leading-snug">
              Баланс карты изменился.
              <template v-if="needsManualAmount">
                Сумма не распознана — укажите её вручную.
              </template>
              <template v-else>Проверьте тип и сумму операции перед сохранением.</template>
            </p>
          </div>
        </section>

        <!-- Transaction form (mirrors AddTransactionPage) -->
        <TransactionForm
          v-model:form-data="formData"
          :accounts="accounts"
          :expense-categories="expenseCategories"
          :income-categories="incomeCategories"
          :user-currency="userCurrency"
          :is-submitting="isSubmitting"
          :is-valid="isValid"
          :error="validationError"
          :split-data="splitData"
          :split-validation-error="splitValidationError"
          @submit="handleSubmit"
          @debt-submitted="onDebtSubmitted"
          @add-participant="addParticipant"
          @remove-participant="removeParticipant"
          @update-participant-amount="updateParticipantAmount"
          @set-split-method="setSplitMethod"
          @set-my-share="setMyShare"
          @set-is-included="setIsIncluded"
          @set-split-enabled="setSplitEnabled"
        />

        <!-- Secondary actions -->
        <div class="space-y-2 pt-1">
          <UButton variant="outline" size="lg" full-width @click="toScanReceipt">
            <UIcon name="document_scanner" size="sm" class="mr-2" />
            Сканировать чек
          </UButton>

          <UButton
            variant="ghost"
            size="lg"
            full-width
            class="text-danger"
            @click="showDismissConfirm = true"
          >
            Отклонить импорт
          </UButton>
        </div>
      </div>
    </main>

    <!-- Dismiss confirmation -->
    <ConfirmDeleteModal
      v-model="showDismissConfirm"
      title="Отклонить импорт?"
      warning-text="Операция будет убрана из инбокса и не попадёт в историю."
      confirm-label="Отклонить"
      @confirm="handleDismiss"
    />
  </div>
</template>
