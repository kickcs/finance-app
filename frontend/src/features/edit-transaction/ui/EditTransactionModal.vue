<script setup lang="ts">
import { ref, watch, computed, inject } from 'vue';
import type { Ref } from 'vue';
import { UModal, UInput, UButton, UTabs, UIcon } from '@/shared/ui';
import { CategoryChips, useCategories } from '@/entities/category';
import { AccountSelector } from '@/entities/account';
import type { AccountWithBalances } from '@/entities/account';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { Transaction } from '@/shared/api/database.types';
import type { User } from '@/shared/api/composables/useAuth';

const props = defineProps<{
  modelValue: boolean;
  transaction: Transaction | null;
  accounts: AccountWithBalances[];
  currency: string;
  isUpdating?: boolean;
  error?: string | null;
  hasSplitDebts?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [updates: Partial<Transaction>];
  cancel: [];
  delete: [];
}>();

// Get user for categories
const user = inject<Ref<User | null>>('user');
const userId = computed(() => user?.value?.id ?? null);
const { getCategoriesByType } = useCategories(userId);

// Check if transaction is a transfer or adjustment
const isTransfer = computed(() => props.transaction?.type === 'transfer');
const isAdjustment = computed(() => props.transaction?.type === 'adjustment');

// Check if transaction is debt-related (cannot be edited)
const isDebtRelated = computed(() => props.transaction?.is_debt_related === true);

// Check if transaction has split debts linked to it (cannot be edited)
const hasSplitDebts = computed(() => props.hasSplitDebts === true);

// Cannot edit if debt-related OR has split debts
const isProtected = computed(() => isDebtRelated.value || hasSplitDebts.value);

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
    }
  },
  { immediate: true },
);

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

function confirm() {
  emit('confirm', {
    type: type.value,
    amount: amount.value,
    account_id: accountId.value,
    category_id: categoryId.value,
    description: description.value || null,
    date: date.value,
  });
}

const isFormValid = computed(() => {
  return accountId.value && categoryId.value && amount.value > 0;
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

    <!-- Protected Mode (debt-related OR has split debts): View Only -->
    <div v-if="isProtected && transaction" class="py-2">
      <div class="text-center mb-4">
        <div
          class="w-12 h-12 mx-auto mb-3 rounded-xl bg-warning-light flex items-center justify-center"
        >
          <UIcon
            :name="hasSplitDebts ? 'group' : 'account_balance_wallet'"
            size="md"
            class="text-warning"
          />
        </div>
        <p class="text-sm text-text-primary-light dark:text-text-primary-dark font-medium mb-0.5">
          {{ hasSplitDebts ? 'Транзакция с раздельным счётом' : 'Транзакция связана с долгом' }}
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
            {{
              hasSplitDebts
                ? 'Эту транзакцию нельзя редактировать, пока есть связанные долги. Сначала закройте долги в разделе "Долги".'
                : 'Эту транзакцию нельзя редактировать или удалять напрямую. Перейдите в раздел "Долги" для управления.'
            }}
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
          <UIcon name="tune" size="md" class="text-slate-500" />
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
        @update:model-value="amount = Number($event) || 0"
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
    </div>

    <template #actions>
      <!-- Protected (debt-related OR split debts) Actions: Close Only -->
      <div v-if="isProtected" class="flex gap-2 w-full">
        <UButton variant="secondary" size="sm" full-width @click="close">Закрыть</UButton>
      </div>

      <!-- Transfer/Adjustment Actions: Cancel + Delete -->
      <div v-else-if="isTransfer || isAdjustment" class="flex gap-2 w-full">
        <UButton variant="secondary" size="sm" full-width @click="close">Отмена</UButton>
        <UButton
          variant="primary"
          size="sm"
          full-width
          class="!bg-danger hover:!bg-danger/90"
          @click="emit('delete')"
        >
          <UIcon name="delete" size="xs" class="mr-1" />
          Удалить
        </UButton>
      </div>

      <!-- Regular Actions: Delete + Cancel + Save -->
      <div v-else class="flex gap-2 w-full">
        <UButton variant="ghost" size="sm" class="!text-danger shrink-0" @click="emit('delete')">
          <UIcon name="delete" size="sm" />
        </UButton>
        <UButton variant="secondary" size="sm" full-width @click="close">Отмена</UButton>
        <UButton
          variant="primary"
          size="sm"
          full-width
          :loading="isUpdating"
          :disabled="!isFormValid"
          @click="confirm"
        >
          Сохранить
        </UButton>
      </div>
    </template>
  </UModal>
</template>
