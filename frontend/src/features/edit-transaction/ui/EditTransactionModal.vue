<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { UModal, UInput, UButton, UTabs, UIcon } from '@/shared/ui';
import { CategoryChips, useCategories } from '@/entities/category';
import { AccountSelector } from '@/entities/account';
import type { AccountWithBalances } from '@/entities/account';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { Transaction } from '@/shared/api/database.types';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { SplitParticipantList, useSplitTransactionEdit } from '@/features/split-expense';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';

const props = defineProps<{
  modelValue: boolean;
  transaction: Transaction | null;
  accounts: AccountWithBalances[];
  currency: string;
  isUpdating?: boolean;
  error?: string | null;
  onSave: (updates: Partial<Transaction>) => Promise<boolean>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [];
  cancel: [];
  delete: [];
}>();

// Get user for categories
const { userId } = useCurrentUser();
const { getCategoriesByType } = useCategories(userId);

// Check if transaction is a transfer or adjustment
const isTransfer = computed(() => props.transaction?.type === 'transfer');
const isAdjustment = computed(() => props.transaction?.type === 'adjustment');

// Check if transaction is debt-related (cannot be edited) — exclude adjustments which reuse is_debt_related as direction flag
const isDebtRelated = computed(
  () => props.transaction?.is_debt_related === true && !isAdjustment.value,
);

// Local form state (only for non-transfer)
const type = ref<'expense' | 'income'>('expense');
const amount = ref(0);
const accountId = ref('');
const categoryId = ref('');
const description = ref('');
const date = ref('');

// Sync form state with transaction prop
watch(
  () => props.transaction,
  (t) => {
    if (t && t.type !== 'transfer') {
      type.value = t.type as 'expense' | 'income';
      amount.value = t.amount;
      accountId.value = t.account_id;
      categoryId.value = t.category_id;
      description.value = t.description || '';
      date.value = t.date ? t.date.split('T')[0] : '';
      dateBeforeEdit.value = date.value;
      amountBeforeEdit.value = t.amount;
    }
  },
  { immediate: true },
);

// Split expense editing — only load for non-protected, non-transfer transactions
const {
  hasSplit,
  hasPendingChanges: hasPendingSplitChanges,
  participants: splitParticipants,
  myShare: splitMyShare,
  updateParticipantAmount,
  updateParticipantName,
  addParticipant,
  removeParticipant,
  handleTransactionAmountChange,
  saveChanges: saveSplitChanges,
  reload: reloadSplitDebts,
} = useSplitTransactionEdit(
  () =>
    !isDebtRelated.value && !isTransfer.value && !isAdjustment.value
      ? (props.transaction?.id ?? null)
      : null,
  userId,
  () => amount.value,
  () => accountId.value,
  () => props.transaction?.currency ?? DEFAULT_CURRENCY,
);

// Reload split debts on reopen for the same transaction
// (the composable's internal watcher only fires when transactionId changes)
watch(
  () => [props.modelValue, props.transaction?.id ?? null] as const,
  ([open, txId], [wasOpen, prevTxId]) => {
    if (open && !wasOpen && txId && txId === prevTxId) {
      reloadSplitDebts();
    }
  },
);

const showAmountStrategyDialog = ref(false);
const showSplitDeleteConfirm = ref(false);
const isConfirming = ref(false);
const amountBeforeEdit = ref(0);
const dateBeforeEdit = ref('');

function handleAmountInput(value: string | number) {
  amount.value = Number(value) || 0;
}

function checkAmountChange() {
  if (hasSplit.value && amount.value !== amountBeforeEdit.value) {
    showAmountStrategyDialog.value = true;
  }
}

function handleAmountStrategyDismiss(open: boolean) {
  showAmountStrategyDialog.value = open;
  // Revert amount when user dismisses without choosing a strategy
  if (!open) amount.value = amountBeforeEdit.value;
}

function handleAmountStrategy(strategy: 'redistribute' | 'keep') {
  handleTransactionAmountChange(amount.value, strategy);
  amountBeforeEdit.value = amount.value;
  showAmountStrategyDialog.value = false;
}

const openSplitDebtsCount = computed(
  () => splitParticipants.value.filter((p) => !p.isClosed && !p.isNew).length,
);

function handleDelete() {
  if (hasSplit.value && openSplitDebtsCount.value > 0) {
    showSplitDeleteConfirm.value = true;
  } else {
    emit('delete');
  }
}

function confirmSplitDelete() {
  showSplitDeleteConfirm.value = false;
  emit('delete');
}

const tabItems = [
  { id: 'expense', label: 'Расход' },
  { id: 'income', label: 'Доход' },
];

// Filter accounts that have a balance in the transaction's currency
const compatibleAccounts = computed(() => {
  const txCurrency = props.transaction?.currency;
  if (!txCurrency) return props.accounts;
  return props.accounts.filter((a) => a.balances.some((b) => b.currency === txCurrency));
});

const categories = computed(() => getCategoriesByType(type.value));

function handleTypeChange(newType: string) {
  type.value = newType as 'expense' | 'income';
  // Reset category if switching types
  const availableCategories = getCategoriesByType(newType as 'expense' | 'income');
  if (!availableCategories.find((c: { id: string }) => c.id === categoryId.value)) {
    categoryId.value = '';
  }
}

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}

async function confirm() {
  if (isConfirming.value) return;

  // Ensure pending amount change is resolved before saving
  if (hasSplit.value && amount.value !== amountBeforeEdit.value) {
    showAmountStrategyDialog.value = true;
    return;
  }

  isConfirming.value = true;
  try {
    const updates: Partial<Transaction> = {
      type: type.value,
      amount: amount.value,
      account_id: accountId.value,
      category_id: categoryId.value,
      description: description.value || null,
      // Only send date if user changed it — sending date-only string
      // to a timestamptz column resets the time component to UTC midnight
      ...(date.value !== dateBeforeEdit.value && { date: date.value }),
    };

    const txSuccess = await props.onSave(updates);
    if (!txSuccess) return;

    // Split save is best-effort: transaction is already saved above,
    // so always close the modal regardless of split outcome.
    if (hasSplit.value || hasPendingSplitChanges.value) {
      await saveSplitChanges();
    }

    emit('saved');
  } finally {
    isConfirming.value = false;
  }
}

const isFormValid = computed(() => {
  const baseValid = !!accountId.value && !!categoryId.value && amount.value > 0;
  if (!baseValid) return false;
  if (hasSplit.value && splitMyShare.value < 0) return false;
  return true;
});
</script>

<template>
  <UModal
    :model-value="modelValue"
    :title="isTransfer ? 'Перевод' : isAdjustment ? 'Коррекция баланса' : 'Редактировать'"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- Error Message -->
    <div v-if="error" class="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20">
      <div class="flex gap-2">
        <UIcon name="error" size="sm" class="text-danger shrink-0" />
        <p class="text-sm text-danger">{{ error }}</p>
      </div>
    </div>

    <!-- Debt-Related Mode: View Only -->
    <div v-if="isDebtRelated && transaction" class="py-2">
      <div class="text-center mb-4">
        <div
          class="w-12 h-12 mx-auto mb-3 rounded-xl bg-warning-light flex items-center justify-center"
        >
          <UIcon name="account_balance_wallet" size="md" class="text-warning" />
        </div>
        <p class="text-sm text-text-primary-light dark:text-text-primary-dark font-medium mb-0.5">
          Транзакция связана с долгом
        </p>
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          Управляйте долгом в разделе "Долги"
        </p>
      </div>

      <!-- Transaction Details -->
      <div class="space-y-2 p-3 rounded-lg bg-surface-light dark:bg-surface-dark">
        <div class="flex justify-between items-center">
          <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark">Сумма</span>
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ formatCurrency(transaction.amount, transaction.currency) }}
          </span>
        </div>
        <div v-if="transaction.description" class="flex justify-between items-center">
          <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Описание
          </span>
          <span class="text-xs text-text-primary-light dark:text-text-primary-dark">
            {{ transaction.description }}
          </span>
        </div>
      </div>

      <!-- Info -->
      <div class="mt-3 p-2.5 rounded-lg bg-warning-light border border-warning/20">
        <div class="flex gap-1.5">
          <UIcon name="info" size="xs" class="text-warning shrink-0 mt-0.5" />
          <p class="text-xs text-warning">
            Эту транзакцию нельзя редактировать или удалять напрямую. Перейдите в раздел "Долги" для
            управления.
          </p>
        </div>
      </div>
    </div>

    <!-- Transfer Mode: Delete Only -->
    <div v-else-if="isTransfer && transaction" class="py-2">
      <div class="text-center mb-4">
        <div
          class="w-12 h-12 mx-auto mb-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center"
        >
          <UIcon name="swap_horiz" size="md" class="text-indigo-500" />
        </div>
        <p class="text-sm text-text-primary-light dark:text-text-primary-dark font-medium mb-0.5">
          Это перевод между счетами
        </p>
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          Переводы можно только удалить
        </p>
      </div>

      <!-- Transfer Details -->
      <div class="space-y-2 p-3 rounded-lg bg-surface-light dark:bg-surface-dark">
        <div class="flex justify-between items-center">
          <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Списание
          </span>
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ formatCurrency(transaction.amount, transaction.currency) }}
          </span>
        </div>
        <div
          v-if="transaction.to_amount && transaction.to_currency"
          class="flex justify-between items-center"
        >
          <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Зачисление
          </span>
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ formatCurrency(transaction.to_amount, transaction.to_currency) }}
          </span>
        </div>
        <div v-if="transaction.description" class="flex justify-between items-center">
          <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Комментарий
          </span>
          <span class="text-xs text-text-primary-light dark:text-text-primary-dark">
            {{ transaction.description }}
          </span>
        </div>
      </div>

      <!-- Warning -->
      <div class="mt-3 p-2.5 rounded-lg bg-danger/10 border border-danger/20">
        <div class="flex gap-1.5">
          <UIcon name="warning" size="xs" class="text-danger shrink-0 mt-0.5" />
          <p class="text-xs text-danger">При удалении балансы счетов будут восстановлены</p>
        </div>
      </div>
    </div>

    <!-- Adjustment Mode: Delete Only -->
    <div v-else-if="isAdjustment && transaction" class="py-2">
      <div class="text-center mb-4">
        <div
          class="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 dark:bg-slate-800/30 flex items-center justify-center"
        >
          <UIcon name="balance" size="md" class="text-slate-500" />
        </div>
        <p class="text-sm text-text-primary-light dark:text-text-primary-dark font-medium mb-0.5">
          Это коррекция баланса
        </p>
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          Коррекции можно только удалить
        </p>
      </div>

      <!-- Adjustment Details -->
      <div class="space-y-2 p-3 rounded-lg bg-surface-light dark:bg-surface-dark">
        <div class="flex justify-between items-center">
          <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark">Сумма</span>
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ transaction.is_debt_related ? '-' : '+'
            }}{{ formatCurrency(transaction.amount, transaction.currency) }}
          </span>
        </div>
        <div v-if="transaction.description" class="flex justify-between items-center">
          <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Описание
          </span>
          <span class="text-xs text-text-primary-light dark:text-text-primary-dark">
            {{ transaction.description }}
          </span>
        </div>
      </div>

      <!-- Warning -->
      <div class="mt-3 p-2.5 rounded-lg bg-danger/10 border border-danger/20">
        <div class="flex gap-1.5">
          <UIcon name="warning" size="xs" class="text-danger shrink-0 mt-0.5" />
          <p class="text-xs text-danger">При удалении баланс счёта будет восстановлен</p>
        </div>
      </div>
    </div>

    <!-- Regular Edit Mode (expense/income) -->
    <div v-else-if="transaction" class="space-y-4">
      <!-- Type Tabs -->
      <UTabs :model-value="type" :items="tabItems" @update:model-value="handleTypeChange" />

      <!-- Account Selector -->
      <AccountSelector
        :accounts="compatibleAccounts"
        :selected-id="accountId"
        label="Счёт"
        @select="accountId = $event"
      />

      <!-- Amount -->
      <UInput
        :model-value="String(amount)"
        label="Сумма"
        placeholder="0"
        variant="currency"
        type="number"
        :suffix="transaction!.currency"
        @update:model-value="handleAmountInput($event)"
        @blur="checkAmountChange"
        @keydown.enter="checkAmountChange"
      />

      <!-- Category Chips -->
      <CategoryChips
        :categories="categories"
        :selected-id="categoryId"
        :rows="type === 'expense' ? 4 : 2"
        label="Категория"
        @select="categoryId = $event"
      />

      <!-- Description & Date Row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <UInput v-model="description" label="Комментарий" placeholder="Описание..." />
        <UInput v-model="date" label="Дата" type="date" />
      </div>

      <!-- Split Section -->
      <div v-if="hasSplit" class="border-t border-border-light dark:border-border-dark pt-4">
        <SplitParticipantList
          :participants="splitParticipants"
          :my-share="splitMyShare"
          :currency="transaction!.currency"
          editable
          @update-amount="updateParticipantAmount"
          @update-name="updateParticipantName"
          @remove="removeParticipant"
          @add="addParticipant"
        />
      </div>
    </div>

    <!-- Amount Change Strategy Dialog -->
    <UModal
      :model-value="showAmountStrategyDialog"
      title="Сумма изменена"
      @update:model-value="handleAmountStrategyDismiss"
    >
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4">
        Вы изменили общую сумму транзакции. Как распределить изменение между участниками?
      </p>
      <template #actions>
        <div class="flex gap-2 w-full">
          <UButton variant="secondary" size="sm" full-width @click="handleAmountStrategy('keep')">
            Оставить доли
          </UButton>
          <UButton
            variant="primary"
            size="sm"
            full-width
            @click="handleAmountStrategy('redistribute')"
          >
            Перераспределить
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Split Delete Confirmation Dialog -->
    <UModal
      :model-value="showSplitDeleteConfirm"
      title="Удалить транзакцию?"
      @update:model-value="showSplitDeleteConfirm = $event"
    >
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-2">
        У этой транзакции есть {{ openSplitDebtsCount }} открытых долгов из раздельного счёта.
      </p>
      <p class="text-sm text-danger">
        При удалении транзакции связанные долги останутся. Управляйте ими в разделе "Долги".
      </p>
      <template #actions>
        <div class="flex gap-2 w-full">
          <UButton variant="secondary" size="sm" full-width @click="showSplitDeleteConfirm = false">
            Отмена
          </UButton>
          <UButton variant="danger" size="sm" full-width @click="confirmSplitDelete">
            Удалить
          </UButton>
        </div>
      </template>
    </UModal>

    <template #actions>
      <!-- Debt-Related Actions: Close Only -->
      <div v-if="isDebtRelated" class="flex gap-2 w-full">
        <UButton variant="secondary" size="sm" full-width @click="close">Закрыть</UButton>
      </div>

      <!-- Transfer/Adjustment Actions: Cancel + Delete -->
      <div v-else-if="isTransfer || isAdjustment" class="flex gap-2 w-full">
        <UButton variant="secondary" size="sm" full-width @click="close">Отмена</UButton>
        <UButton variant="danger" size="sm" full-width @click="handleDelete()">
          <UIcon name="delete" size="xs" class="mr-1" />
          Удалить
        </UButton>
      </div>

      <!-- Regular Actions: Delete + Cancel + Save -->
      <div v-else class="flex gap-2 w-full">
        <UButton
          variant="ghost"
          size="sm"
          class="!text-danger shrink-0"
          aria-label="Удалить"
          @click="handleDelete()"
        >
          <UIcon name="delete" size="sm" />
        </UButton>
        <UButton variant="secondary" size="sm" full-width @click="close">Отмена</UButton>
        <UButton
          variant="primary"
          size="sm"
          full-width
          :loading="isUpdating || isConfirming"
          :disabled="!isFormValid"
          @click="confirm"
        >
          Сохранить
        </UButton>
      </div>
    </template>
  </UModal>
</template>
