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
import { useInboxSortOrder } from '../model/useInboxSortOrder';
import { decideCategoryPrefill } from '../model/categoryPrefill';

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

// Retry bookkeeping: if submitAndWait succeeded but confirmImported failed
// (e.g. network), the transaction (and any split debts) already exist. On a
// second attempt we must reuse the created id and skip re-creation, otherwise
// the user gets a duplicate transaction / duplicate debts. Reset on item switch
// and after a successful confirm. (Mirrors the importConfirmed guard in
// scan-receipt/useSubmitStep.ts.)
const createdTransactionId = ref<string | null>(null);
const splitDebtsCreated = ref(false);

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
    // Fresh import → fresh retry bookkeeping.
    createdTransactionId.value = null;
    splitDebtsCreated.value = false;

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
    // occurred_at may be null when the backend couldn't parse a date → default to now.
    updateField('date', current.occurred_at ? new Date(current.occurred_at).getTime() : Date.now());
    updateField('description', current.merchant ?? '');
    if (current.suggested_account_id) {
      updateField('accountId', current.suggested_account_id);
    }
  },
  { immediate: true },
);

// Категория из истории мерчанта: отдельный watch, т.к. категории грузятся
// асинхронно и могут прийти позже item. Решение принимается один раз на item
// (categoryPrefilledId); 'wait' оставляет попытку до загрузки категорий.
let categoryPrefilledId: string | null = null;
watch(
  [item, expenseCategories, incomeCategories],
  ([current]) => {
    if (!current || current.id === categoryPrefilledId) return;
    // Основной prefill-watch должен успеть сбросить форму для этого item —
    // иначе решение принималось бы по данным предыдущего импорта.
    if (prefilledId !== current.id) return;
    const pool =
      formData.value.type === 'income' ? incomeCategories.value : expenseCategories.value;
    const decision = decideCategoryPrefill({
      suggestedCategoryId: current.suggested_category_id,
      currentCategoryId: formData.value.categoryId,
      pool,
    });
    if (decision === 'wait') return;
    categoryPrefilledId = current.id;
    if (decision === 'apply' && current.suggested_category_id) {
      updateField('categoryId', current.suggested_category_id);
    }
  },
  { immediate: true },
);

// --- Context card presentation ----------------------------------------------
const isBalanceChange = computed(() => item.value?.type === 'balance_change');
const needsManualAmount = computed(() => isBalanceChange.value && item.value?.amount === null);
const relativeDate = computed(() =>
  item.value?.occurred_at ? formatRelativeDate(new Date(item.value.occurred_at)) : '',
);

// --- Navigation between pending imports --------------------------------------
// The next import follows the user's chosen review order (same as the inbox list).
const { sortItems } = useInboxSortOrder();

function goNextOrBack() {
  const ordered = sortItems(items.value);
  const currentIndex = ordered.findIndex((i) => i.id === item.value?.id);
  const remaining = ordered.filter((i) => i.id !== item.value?.id);
  // Continue from the current position in the chosen order; wrap to the top
  // when the current item was the last one (or is already gone from the list).
  const next = remaining[Math.max(currentIndex, 0)] ?? remaining[0];
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

  // Retry-safe: if a previous attempt already created the transaction (confirm
  // then failed), reuse that id instead of creating a second transaction.
  let transactionId = createdTransactionId.value;
  if (!transactionId) {
    transactionId = await submitAndWait(userId.value, formData.value);
    if (!transactionId) return; // error already shown by the mutation
    createdTransactionId.value = transactionId;
  }

  // Split debts: create only once. On a retry where the transaction already
  // existed, the debts may have been created too — skip to avoid duplicates.
  if (isSplit && !splitDebtsCreated.value) {
    const success = await createDebtsForSplit(
      transactionId,
      userId.value,
      formData.value.accountId,
      formData.value.currency,
      formData.value.date,
    );
    if (!success) {
      const rolledBack = await rollbackTransaction(transactionId, userId.value);
      if (rolledBack) {
        // Transaction undone → clear bookkeeping so a fresh attempt starts clean.
        createdTransactionId.value = null;
      }
      validationError.value = rolledBack
        ? 'Не удалось создать долги для раздельного счёта. Операция отменена.'
        : 'Не удалось создать часть долгов. Транзакция сохранена — проверьте её в истории.';
      return;
    }
    splitDebtsCreated.value = true;
  }

  try {
    await confirmImported(current.id, {
      transactionId,
      accountId: formData.value.accountId,
      toAccountId:
        formData.value.type === 'transfer' ? (formData.value.toAccountId ?? undefined) : undefined,
    });
  } catch {
    // Transaction (and split debts) already created; only the confirm failed.
    // Keep createdTransactionId/splitDebtsCreated set so a retry resumes here
    // without duplicating anything.
    toast({
      title: 'Транзакция создана',
      description: 'Но не удалось отметить импорт подтверждённым. Проверьте инбокс.',
      variant: 'warning',
    });
    return;
  }

  // Import fully handled → clear retry state before moving on.
  createdTransactionId.value = null;
  splitDebtsCreated.value = false;
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
    <main
      class="flex-1 overflow-y-auto px-4 md:px-8 pt-2 md:pt-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]"
    >
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
        class="md:max-w-xl md:mx-auto md:bg-card-light md:dark:bg-card-dark md:rounded-3xl md:shadow-sm md:border md:border-border-light md:dark:border-border-dark md:p-6 md:mt-2 space-y-3"
      >
        <!-- Provenance / context card (single compact row) -->
        <section
          class="rounded-2xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden animate-fadeInUp"
        >
          <div class="flex items-center gap-3 px-3.5 py-2.5">
            <div
              class="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center shrink-0"
            >
              <UIcon name="telegram" size="sm" class="text-primary" />
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
                <span class="shrink-0 text-primary font-medium">Из Telegram</span>
                <span aria-hidden="true">·</span>
                <span class="truncate">{{ item.card_mask }}</span>
                <template v-if="relativeDate">
                  <span aria-hidden="true">·</span>
                  <span class="shrink-0">{{ relativeDate }}</span>
                </template>
              </div>
            </div>
          </div>

          <!-- Balance-change explainer -->
          <div
            v-if="isBalanceChange"
            class="mx-3.5 mb-2.5 flex items-start gap-2 rounded-xl bg-info-light px-3 py-2"
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
          :hide-scan-receipt="true"
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
        <div class="grid grid-cols-2 gap-2">
          <UButton variant="outline" size="md" full-width @click="toScanReceipt">
            <UIcon name="document_scanner" size="sm" class="mr-1.5" />
            Скан чека
          </UButton>

          <UButton
            variant="ghost"
            size="md"
            full-width
            class="text-danger"
            @click="showDismissConfirm = true"
          >
            Отклонить
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
