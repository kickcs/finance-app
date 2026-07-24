<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { UButton, UIcon, NotFoundState, ConfirmDeleteModal, useToast } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';
import {
  useTransactionForm,
  useSubmitTransaction,
  HeroAmount,
  TransferPanel,
  usePanelState,
} from '@/features/add-transaction';
import { useSplitExpense } from '@/features/split-expense';
import { useAccounts, AccountPickerSheet } from '@/entities/account';
import { useCategories, CategoryPickerSheet } from '@/entities/category';
import { useDebts } from '@/entities/debt';
import { useCloseAllDebts } from '@/features/close-debt';
import { useHashtags } from '@/entities/transaction';
import { usePeople } from '@/entities/person';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { navigateBackTo } from '@/app/router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { formatDate, formatRelativeDate } from '@/shared/lib/format/date';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { Calendar } from '@/shared/ui/primitives/calendar';
import { CalendarDate, type DateValue } from '@internationalized/date';
import { useTelegramBackButton } from '@/shared/lib/telegram/useTelegramBackButton';
import { useImportedTransactions, type ImportedTransaction } from '@/entities/imported-transaction';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { useInboxSortOrder } from '../model/useInboxSortOrder';
import { decideCategoryPrefill } from '../model/categoryPrefill';
import { reviewRows } from '../model/reviewRows';
import {
  eligibleRepaymentGroupsForImport,
  findExactRepaymentMatch,
  debtsCountLabel,
  type RepaymentGroup,
} from '../model/debtRepayment';
import {
  emptyDebtAssign,
  debtDirectionForType,
  validateDebtAssign,
  createDebtForImport,
  createCommissionTransaction,
  type DebtAssignState,
} from '../model/debtAssign';
import DebtRepaymentSheet from './DebtRepaymentSheet.vue';
import DebtAssignSheet from './DebtAssignSheet.vue';
import ActionChip from './ActionChip.vue';
import ReviewFieldRow from './ReviewFieldRow.vue';
import TypeSheet from './TypeSheet.vue';
import CommentSheet from './CommentSheet.vue';

const SplitExpenseDrawer = defineAsyncComponent(
  () => import('@/features/split-expense/ui/SplitExpenseDrawer.vue'),
);

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
// Комиссия — отдельная транзакция после основной; если она не удалась, а долг
// уже создан, повтор не должен списывать комиссию дважды.
const commissionCreated = ref(false);

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

// --- Пометка операции как долга на человека -----------------------------------
const { people, createPerson } = usePeople(userId);
const debtAssign = ref<DebtAssignState>(emptyDebtAssign());
const debtSheetOpen = ref(false);

function applyDebtAssign(next: DebtAssignState) {
  debtAssign.value = next;
  // Разделение расхода и пометка долгом взаимоисключающие — сумма целиком уходит в долг.
  if (splitData.value.enabled) setSplitEnabled(false);
}

function resetDebtAssign() {
  debtAssign.value = emptyDebtAssign();
  commissionCreated.value = false;
}

// --- Погашение существующего долга -------------------------------------------
const { debts } = useDebts(userId);
const { closeAllDebts, isClosing } = useCloseAllDebts();
const showRepaymentSheet = ref(false);
const repaymentSuggestionDismissed = ref(false);
// Retry-bookkeeping отдельно от createdTransactionId (обычного сабмита):
// платёж прошёл, confirm упал → повтор не должен создать второй платёж.
const repaymentTransactionId = ref<string | null>(null);

const eligibleGroups = computed(() =>
  item.value ? eligibleRepaymentGroupsForImport(debts.value, item.value) : [],
);
const repaymentMatch = computed<RepaymentGroup | null>(() =>
  item.value && !repaymentSuggestionDismissed.value
    ? findExactRepaymentMatch(eligibleGroups.value, item.value)
    : null,
);
const repaymentMatchText = computed(() => {
  const match = repaymentMatch.value;
  if (!match) return '';
  const base =
    match.debtType === 'given'
      ? `Похоже, это возврат долга от ${match.personName}`
      : `Похоже, это возврат вашего долга: ${match.personName}`;
  if (match.debts.length <= 1) return base;
  return `${base} (${debtsCountLabel(match.debts.length)})`;
});

async function repayGroup(group: RepaymentGroup) {
  if (isClosing.value || isSubmitting.value) return;
  const current = item.value;
  if (!current || !userId.value) return;
  showRepaymentSheet.value = false;
  validationError.value = null;

  if (!formData.value.accountId) {
    validationError.value = 'Выберите счёт для транзакции';
    return;
  }

  const next = computeNext();
  const amount = Math.abs(current.amount ?? 0);

  let transactionId = repaymentTransactionId.value;
  if (!transactionId) {
    let created: string | null = null;
    const ok = await closeAllDebts(group.debts, formData.value.accountId, userId.value, {
      paymentAmount: amount,
      transactionDate: current.occurred_at ?? undefined,
      onTransactionCreated: (id) => {
        created = id;
      },
      skipSuccessToast: true,
      errorToastTitle: 'Не удалось провести платёж',
    });
    // Ошибка уже показана тостом внутри closeAllDebts.
    if (!ok || !created) return;
    transactionId = created;
    repaymentTransactionId.value = created;
  }

  try {
    await confirmImported(current.id, {
      transactionId,
      accountId: formData.value.accountId,
    });
  } catch {
    toast({
      title: 'Платёж проведён',
      description: 'Но не удалось отметить импорт подтверждённым. Проверьте инбокс.',
      variant: 'warning',
    });
    return;
  }

  toast({ title: 'Платёж проведён', variant: 'success' });
  repaymentTransactionId.value = null;
  goTo(next);
}

// --- Чеклист-ревью: UI-стейт шторок и производные значения -------------------
const typeSheetOpen = ref(false);
const accountSheetOpen = ref(false);
const categorySheetOpen = ref(false);
const commentSheetOpen = ref(false);
const splitDrawerOpen = ref(false);
const calendarOpen = ref(false);

const rows = computed(() => reviewRows(formData.value.type, hasDebtAssign.value));

// Состояние счёта/валюты/баланса для HeroAmount — тот же usePanelState, что в панелях.
const {
  selectedAccount,
  availableCurrencies,
  isMultiCurrency,
  currencySymbol,
  currentBalance,
  hasSufficientFunds,
  handleAccountChange,
} = usePanelState(
  {
    get formData() {
      return formData.value;
    },
    get accounts() {
      return accounts.value;
    },
  },
  (_event, value) => {
    formData.value = value;
  },
);

const { hashtags } = useHashtags(userId);

const categoriesPool = computed(() =>
  formData.value.type === 'income' ? incomeCategories.value : expenseCategories.value,
);
const selectedCategory = computed(
  () => categoriesPool.value.find((c) => c.id === formData.value.categoryId) ?? null,
);

const displayDate = computed(() => formatDate(formData.value.date, { format: 'short' }));
const calendarValue = computed(() => {
  const d = new Date(formData.value.date);
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
});

function onCalendarSelect(value: DateValue | undefined) {
  if (!value) return;
  const date = new Date(value.year, value.month - 1, value.day);
  updateField('date', date.getTime());
  calendarOpen.value = false;
}

// CategoryPickerSheet по контракту не закрывает себя сам — закрытие на родителе
// (см. CategoryPicker.selectCategory).
function selectCategory(categoryId: string) {
  updateField('categoryId', categoryId);
  categorySheetOpen.value = false;
}

const reviewType = computed<'expense' | 'income' | 'transfer'>(() =>
  formData.value.type === 'income' || formData.value.type === 'transfer'
    ? formData.value.type
    : 'expense',
);

// Направление долга по типу операции; перевод долгом быть не может.
const debtDirection = computed(() =>
  reviewType.value === 'transfer' ? null : debtDirectionForType(reviewType.value),
);
const hasDebtAssign = computed(() => debtAssign.value.personName.trim().length > 0);

const typeLabel = computed(() => {
  if (reviewType.value === 'income') return 'Доход';
  if (reviewType.value === 'transfer') return 'Перевод';
  return 'Расход';
});

// Смена типа: сброс категории/целевого счёта — как applyTypeChange в TransactionForm;
// настроенное разделение применимо только к расходу, сбрасываем явно.
function applyType(newType: 'expense' | 'income' | 'transfer') {
  if (newType === formData.value.type) return;
  if (formData.value.type === 'expense' && splitData.value.enabled) {
    setSplitEnabled(false);
  }
  // Перевод долгом быть не может — сбрасываем пометку, если она была выставлена.
  if (newType === 'transfer' && hasDebtAssign.value) {
    resetDebtAssign();
  }
  setType(newType);
}

const hasSplit = computed(
  () => !!splitData.value.enabled && splitData.value.participants.length > 0,
);
const splitChipLabel = computed(() =>
  hasSplit.value
    ? `Разделено на ${splitData.value.participants.length + (splitData.value.isIncluded ? 1 : 0)}`
    : 'Разделить',
);

const debtChipLabel = computed(() => {
  if (!hasDebtAssign.value) return 'В долг';
  const feeSuffix = debtAssign.value.fee > 0 ? ' · комиссия' : '';
  return `Долг: ${debtAssign.value.personName}${feeSuffix}`;
});

// В долг-режиме категория скрыта и не выбирается (см. reviewRows) — isValid из
// useTransactionForm требует categoryId для expense/income и заблокировал бы
// кнопку. Для этого режима валидность проверяем отдельно: счёт + сумма > 0,
// саму пометку долга проверяет validateDebtAssign перед сабмитом.
const submitDisabled = computed(() => {
  if (isClosing.value) return true;
  if (hasDebtAssign.value) {
    return !formData.value.accountId || formData.value.amount <= 0;
  }
  return !isValid.value;
});

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
    repaymentSuggestionDismissed.value = false;
    repaymentTransactionId.value = null;
    resetDebtAssign();

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
const provenanceTitle = computed(
  () => item.value?.merchant || (isBalanceChange.value ? 'Изменение баланса' : 'Операция по карте'),
);

// --- Navigation between pending imports --------------------------------------
// The next import follows the user's chosen review order (same as the inbox list).
const { sortItems } = useInboxSortOrder();

function computeNext(): ImportedTransaction | null {
  const ordered = sortItems(items.value);
  const currentIndex = ordered.findIndex((i) => i.id === item.value?.id);
  const remaining = ordered.filter((i) => i.id !== item.value?.id);
  // Продолжаем с текущей позиции в выбранном порядке; wrap на начало,
  // когда текущий был последним.
  return remaining[Math.max(currentIndex, 0)] ?? remaining[0] ?? null;
}

function goTo(next: ImportedTransaction | null) {
  if (next) {
    router.replace({ name: ROUTE_NAMES.IMPORT_CONFIRM, params: { id: next.id } });
  } else {
    router.replace({ name: ROUTE_NAMES.IMPORT_INBOX });
  }
}

function goToInbox() {
  navigateBackTo({ name: ROUTE_NAMES.IMPORT_INBOX });
}

useTelegramBackButton(goToInbox);

// --- Submit ------------------------------------------------------------------
async function handleSubmit() {
  // Double-tap guard: a second tap before the first settles would duplicate.
  if (isSubmitting.value) return;

  const current = item.value;
  if (!current || !userId.value) return;

  validationError.value = null;

  if (!formData.value.accountId) {
    validationError.value = 'Выберите счёт для транзакции';
    return;
  }

  const isDebt = hasDebtAssign.value && !!debtDirection.value;
  // Комиссия имеет смысл только при выдаче долга; при переключении типа на доход
  // пометка переживает смену направления, а fee не должна утечь в taken-ветку.
  const debtFee = isDebt && debtDirection.value === 'given' ? debtAssign.value.fee : 0;
  if (isDebt) {
    const err = validateDebtAssign(
      { ...debtAssign.value, fee: debtFee },
      formData.value.amount,
      debtDirection.value!,
    );
    if (err) {
      validationError.value = err;
      return;
    }
  }

  // Разделение расхода несовместимо с пометкой долгом (см. applyDebtAssign) —
  // !isDebt здесь не полагание на взаимоисключение, а страховка на случай рассинхрона.
  const isSplit = !isDebt && splitData.value.enabled && splitData.value.participants.length > 0;
  if (isSplit && !splitIsValid.value) {
    validationError.value = splitValidationError.value || 'Проверьте данные разделения расхода';
    return;
  }

  // "Следующий" фиксируется до мутации: после confirmImported текущий
  // элемент уже удалён из кэша точечно, и computeNext() потерял бы позицию.
  const next = computeNext();

  // Retry-safe: if a previous attempt already created the transaction (confirm
  // then failed), reuse that id instead of creating a second transaction.
  let transactionId = createdTransactionId.value;
  if (!transactionId) {
    if (isDebt) {
      try {
        const created = await createDebtForImport(userId.value, {
          direction: debtDirection.value!,
          personName: debtAssign.value.personName,
          totalAmount: formData.value.amount,
          fee: debtFee,
          accountId: formData.value.accountId,
          currency: formData.value.currency,
          dateMs: formData.value.date,
          description: formData.value.description,
        });
        transactionId = created.transactionId;
        createdTransactionId.value = transactionId;
      } catch {
        validationError.value = 'Не удалось создать долг';
        return;
      }
      invalidateDebtRelated(queryClient, userId.value).catch(console.error);
    } else {
      transactionId = await submitAndWait(userId.value, formData.value);
      if (!transactionId) return; // error already shown by the mutation
      createdTransactionId.value = transactionId;
    }
  }

  // Комиссия — отдельная транзакция после того, как долг уже создан. Если она
  // не проходит, долг всё равно остаётся валидным — просто предупреждаем и
  // продолжаем обычный confirm-путь (не блокируем пользователя).
  if (debtFee > 0 && !commissionCreated.value) {
    try {
      await createCommissionTransaction(userId.value, {
        accountId: formData.value.accountId,
        amount: debtFee,
        currency: formData.value.currency,
        dateMs: formData.value.date,
      });
      commissionCreated.value = true;
    } catch {
      toast({
        title: 'Долг создан',
        description: 'Не удалось записать комиссию — добавьте её вручную.',
        variant: 'warning',
      });
    }
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
  resetDebtAssign();
  goTo(next);
}

// --- Dismiss -----------------------------------------------------------------
const showDismissConfirm = ref(false);

async function handleDismiss() {
  const current = item.value;
  showDismissConfirm.value = false;
  if (!current) return;
  const next = computeNext();
  await dismissImported(current.id);
  goTo(next);
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
      <AppHeader title="Подтверждение" show-back blur @back="goToInbox" />
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
        @click="goToInbox"
      >
        <UIcon name="close" size="sm" />
      </button>
    </div>

    <!-- Content -->
    <main class="flex-1 overflow-y-auto px-4 md:px-8 pt-2 md:pt-4 pb-4">
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
        <!-- Хиро-зона: происхождение + сумма + тип -->
        <section
          class="rounded-2xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-3.5 pt-2.5 pb-3 animate-fadeInUp"
        >
          <div
            class="flex items-center justify-center gap-1.5 text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            <span
              class="truncate font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
              {{ provenanceTitle }}
            </span>
            <span aria-hidden="true">·</span>
            <span class="shrink-0">{{ item.card_mask }}</span>
            <template v-if="relativeDate">
              <span aria-hidden="true">·</span>
              <span class="shrink-0">{{ relativeDate }}</span>
            </template>
            <span aria-hidden="true">·</span>
            <span class="shrink-0 text-primary font-medium">Telegram</span>
          </div>

          <HeroAmount
            v-if="!rows.transferPanel"
            class="mt-1"
            :amount="formData.amount"
            :currency="formData.currency"
            :currency-symbol="currencySymbol"
            :available-currencies="availableCurrencies"
            :is-multi-currency="isMultiCurrency"
            :show-insufficient-funds="!hasSufficientFunds"
            :current-balance="selectedAccount ? currentBalance : undefined"
            :autofocus="needsManualAmount"
            @update:amount="updateField('amount', $event)"
            @update:currency="updateField('currency', $event)"
          />

          <div class="flex justify-center" :class="rows.transferPanel ? 'mt-2' : ''">
            <button
              type="button"
              class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-primary-light transition-colors"
              @click="typeSheetOpen = true"
            >
              {{ typeLabel }}
              <UIcon
                name="expand_more"
                size="xs"
                class="text-text-tertiary-light dark:text-text-tertiary-dark"
              />
            </button>
          </div>

          <!-- Balance-change explainer -->
          <div
            v-if="isBalanceChange"
            class="mt-2.5 flex items-start gap-2 rounded-xl bg-info-light px-3 py-2"
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

        <!-- Автоподсказка: сумма точно совпадает с остатком долгов одного человека -->
        <section
          v-if="repaymentMatch"
          class="rounded-2xl border border-primary/30 bg-primary-light flex items-center gap-3 px-3.5 py-2.5 animate-fadeInUp"
        >
          <UIcon name="handshake" size="sm" class="text-primary shrink-0" />
          <p
            class="flex-1 text-sm text-text-primary-light dark:text-text-primary-dark leading-snug"
          >
            {{ repaymentMatchText }}
          </p>
          <UButton
            size="sm"
            :disabled="isClosing || isSubmitting"
            @click="repayGroup(repaymentMatch)"
          >
            Применить
          </UButton>
          <button
            type="button"
            aria-label="Скрыть подсказку"
            class="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary-light dark:text-text-tertiary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors shrink-0"
            @click="repaymentSuggestionDismissed = true"
          >
            <UIcon name="close" size="xs" />
          </button>
        </section>

        <!-- TransferPanel вместо чеклиста счёта/категории (только для перевода) -->
        <section v-if="rows.transferPanel" class="animate-fadeInUp">
          <TransferPanel
            :form-data="formData"
            :accounts="accounts"
            :user-currency="userCurrency"
            @update:form-data="formData = $event"
          />
        </section>

        <!-- Чеклист полей -->
        <section
          class="rounded-2xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden animate-fadeInUp divide-y divide-border-light dark:divide-border-dark"
        >
          <ReviewFieldRow
            v-if="rows.account"
            icon="account_balance_wallet"
            label="Счёт"
            :value="selectedAccount?.name ?? null"
            @click="accountSheetOpen = true"
          />

          <ReviewFieldRow
            v-if="rows.category"
            icon="sell"
            label="Категория"
            :value="selectedCategory?.name ?? null"
            @click="categorySheetOpen = true"
          />

          <Popover v-model:open="calendarOpen">
            <PopoverTrigger as-child>
              <ReviewFieldRow icon="calendar_today" label="Дата" :value="displayDate" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              :side-offset="8"
              :collision-padding="16"
              class="w-auto p-0"
            >
              <Calendar
                :model-value="calendarValue"
                locale="ru-RU"
                @update:model-value="onCalendarSelect"
              />
            </PopoverContent>
          </Popover>

          <ReviewFieldRow
            icon="edit_note"
            label="Комментарий"
            :value="formData.description || null"
            placeholder="Добавить"
            @click="commentSheetOpen = true"
          />
        </section>

        <!-- Ряд компакт-действий -->
        <div class="flex flex-wrap gap-1.5 animate-fadeInUp">
          <ActionChip
            v-if="eligibleGroups.length > 0 && !repaymentMatch"
            icon="handshake"
            label="Возврат долга"
            :disabled="isClosing || isSubmitting"
            @click="showRepaymentSheet = true"
          />

          <ActionChip icon="document_scanner" label="Чек" @click="toScanReceipt" />

          <ActionChip
            v-if="rows.split"
            icon="group"
            :label="splitChipLabel"
            :active="hasSplit"
            reset-label="Сбросить разделение"
            @click="splitDrawerOpen = true"
            @reset="setSplitEnabled(false)"
          />

          <ActionChip
            v-if="debtDirection && !hasSplit"
            icon="volunteer_activism"
            :label="debtChipLabel"
            :active="hasDebtAssign"
            reset-label="Сбросить пометку долга"
            @click="debtSheetOpen = true"
            @reset="resetDebtAssign()"
          />
        </div>
      </div>
    </main>

    <!-- Sticky-бар: ошибка + Отклонить/Подтвердить -->
    <div
      v-if="item"
      class="shrink-0 border-t border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div class="md:max-w-xl md:mx-auto">
        <p v-if="validationError" data-testid="validation-error" class="mb-2 text-xs text-danger">
          {{ validationError }}
        </p>
        <div class="flex gap-2">
          <UButton
            variant="ghost"
            size="lg"
            class="text-danger shrink-0"
            @click="showDismissConfirm = true"
          >
            Отклонить
          </UButton>
          <UButton
            variant="primary"
            size="lg"
            class="flex-1"
            data-testid="submit-btn"
            :loading="isSubmitting"
            :disabled="submitDisabled"
            @click="handleSubmit"
          >
            Подтвердить
          </UButton>
        </div>
      </div>
    </div>

    <!-- Dismiss confirmation -->
    <ConfirmDeleteModal
      v-model="showDismissConfirm"
      title="Отклонить импорт?"
      warning-text="Операция будет убрана из инбокса и не попадёт в историю."
      confirm-label="Отклонить"
      @confirm="handleDismiss"
    />

    <DebtRepaymentSheet
      v-model:open="showRepaymentSheet"
      :groups="eligibleGroups"
      :amount="Math.abs(item?.amount ?? 0)"
      :currency="item?.currency ?? userCurrency ?? 'USD'"
      @select="repayGroup"
    />

    <DebtAssignSheet
      v-model:open="debtSheetOpen"
      :state="debtAssign"
      :direction="debtDirection ?? 'given'"
      :total-amount="formData.amount"
      :currency="formData.currency"
      :people="people"
      @apply="applyDebtAssign"
      @save-person="createPerson({ name: $event })"
    />

    <TypeSheet
      v-model:open="typeSheetOpen"
      :model-value="reviewType"
      @update:model-value="applyType"
    />

    <AccountPickerSheet
      v-model:open="accountSheetOpen"
      :accounts="accounts"
      :selected-id="formData.accountId"
      @select="handleAccountChange"
    />

    <CategoryPickerSheet
      v-model:open="categorySheetOpen"
      :categories="categoriesPool"
      :selected-id="formData.categoryId"
      @select="selectCategory"
    />

    <CommentSheet
      v-model:open="commentSheetOpen"
      :model-value="formData.description"
      :hashtags="hashtags"
      @update:model-value="(v: string) => updateField('description', v)"
    />

    <SplitExpenseDrawer
      v-if="splitData"
      :open="splitDrawerOpen"
      :total-amount="formData.amount"
      :currency="formData.currency"
      :split-data="splitData"
      :validation-error="splitValidationError"
      @update:open="splitDrawerOpen = $event"
      @add-participant="
        (name: string, fromContacts: boolean, color?: string) =>
          addParticipant(name, fromContacts, color)
      "
      @remove-participant="removeParticipant"
      @update-participant-amount="(id, amount) => updateParticipantAmount(id, amount)"
      @set-method="setSplitMethod"
      @set-my-share="setMyShare"
      @set-is-included="setIsIncluded"
      @set-enabled="setSplitEnabled"
    />
  </div>
</template>
