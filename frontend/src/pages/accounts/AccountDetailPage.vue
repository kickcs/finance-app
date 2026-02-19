<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { UButton, UIcon, UCard, EmptyState, USpinner, NotFoundState } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';
import { formatCurrency } from '@/shared/lib/format/currency';
import {
  useAccounts,
  getAccountTypeLabel,
  type AccountWithBalances,
} from '@/entities/account';
import {
  VirtualGroupedTransactionList,
  TransactionGroupSkeleton,
  useInfiniteAccountTransactions,
  useGroupedTransactions,
  transactionsApi,
  transactionQueryKeys,
  type Transaction,
} from '@/entities/transaction';
import { useQuery } from '@tanstack/vue-query';
import {
  EditAccountModal,
  DeleteAccountModal,
  useEditAccount,
} from '@/features/edit-account';
import {
  EditTransactionModal,
  DeleteTransactionModal,
  useEditTransaction,
} from '@/features/edit-transaction';
import type { Account } from '@/shared/api/database.types';
import { navigateBack } from '@/app/router';
import { useProfile } from '@/shared/api';
import { debtsApi } from '@/entities/debt';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';

const router = useRouter();
const route = useRoute();
const { userId } = useCurrentUser();
const accountId = computed(() => route.params.id as string);

// Get user currency (profile-first, falls back to localStorage)
const { currency } = useUserCurrency();

// Profile for default account management
const { profile, setDefaultAccount } = useProfile(userId);

const { accounts, isLoading } = useAccounts(userId);

const account = computed<AccountWithBalances | null>(() => {
  return accounts.value.find((a) => a.id === accountId.value) ?? null;
});

// Account transactions with infinite scroll
const {
  transactions: accountTransactions,
  isLoading: isLoadingTransactions,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
} = useInfiniteAccountTransactions(accountId);

// Helper to get account name by id
function getAccountName(id: string | null): string {
  if (!id) return 'Счёт';
  const acc = accounts.value.find((a) => a.id === id);
  return acc?.name || 'Счёт';
}

// Group transactions by date
const groupedTransactions = useGroupedTransactions(accountTransactions, {
  // API already returns transactions newest-first; preserve server order for groups
  sortGroups: false,
  // Within each group: sort by transaction time desc, then by created_at desc
  sortTransactions: (a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  },
  // Transfer totals are account-specific: incoming transfers add, outgoing subtract
  computeTotal: (txs) => {
    const currentAccountId = accountId.value;
    return txs.reduce((sum, tx) => {
      if (tx.type === 'transfer') {
        if (tx.to_account_id === currentAccountId) {
          return sum + (tx.to_amount ?? 0);
        }
        return sum - tx.amount;
      }
      return sum + (tx.type === 'income' ? tx.amount : -tx.amount);
    }, 0);
  },
});

// Edit account
const showEditAccountModal = ref(false);
const showDeleteAccountModal = ref(false);
const {
  isUpdating: isUpdatingAccount,
  isDeleting: isDeletingAccount,
  error: accountError,
  update: updateAccountFn,
  remove: removeAccountFn,
  isDefaultAccount,
} = useEditAccount(userId.value);

// Total transaction count for this account (lazy - only fetched when delete modal opens)
const {
  data: accountTransactionsCount,
  isLoading: isLoadingTransactionsCount,
} = useQuery({
  queryKey: computed(() =>
    transactionQueryKeys.countByAccount(accountId.value),
  ),
  queryFn: () => transactionsApi.countByAccount(accountId.value),
  enabled: computed(() => showDeleteAccountModal.value && !!accountId.value),
});

// Check before opening delete modal
function openDeleteModal() {
  // Pre-check if this is the default account
  if (account.value && isDefaultAccount(account.value.id)) {
    // Set error manually so it shows in modal
    accountError.value =
      'Нельзя удалить счёт по умолчанию. Сначала назначьте другой счёт по умолчанию.';
  }
  showDeleteAccountModal.value = true;
}

async function handleUpdateAccount(updates: Partial<Account>) {
  if (!account.value) return;
  const success = await updateAccountFn(account.value.id, updates);
  if (success) {
    showEditAccountModal.value = false;
  }
}

async function handleDeleteAccount() {
  if (!account.value) return;
  const success = await removeAccountFn(account.value.id);
  if (success) {
    showDeleteAccountModal.value = false;
    router.push({ name: 'accounts' });
  }
}

// Edit transaction
const showEditTransactionModal = ref(false);
const showDeleteTransactionModal = ref(false);
const selectedTransaction = ref<Transaction | null>(null);
const selectedTransactionHasSplitDebts = ref(false);
const {
  isUpdating: isUpdatingTransaction,
  isDeleting: isDeletingTransaction,
  error: transactionError,
  update: updateTransactionFn,
  remove: removeTransactionFn,
} = useEditTransaction(userId.value);

async function handleTransactionClick(transaction: Transaction) {
  selectedTransaction.value = transaction;
  selectedTransactionHasSplitDebts.value = false;

  // Check if this transaction has OPEN split debts (closed debts don't block editing)
  if (!transaction.is_debt_related && userId.value) {
    try {
      const allDebts = await debtsApi.getAll(userId.value);
      const linkedDebts = allDebts.filter(
        (d) => d.source_transaction_id === transaction.id && !d.is_closed,
      );
      selectedTransactionHasSplitDebts.value = linkedDebts.length > 0;
    } catch {
      selectedTransactionHasSplitDebts.value = false;
    }
  }

  showEditTransactionModal.value = true;
}

async function handleUpdateTransaction(updates: Partial<Transaction>) {
  if (!selectedTransaction.value) return;
  const success = await updateTransactionFn(selectedTransaction.value, updates);
  if (success) {
    showEditTransactionModal.value = false;
    // Query cache will be automatically invalidated
  }
}

function handleDeleteTransactionClick() {
  showEditTransactionModal.value = false;
  showDeleteTransactionModal.value = true;
}

async function handleDeleteTransaction() {
  if (!selectedTransaction.value) return;
  const success = await removeTransactionFn(selectedTransaction.value);
  if (success) {
    showDeleteTransactionModal.value = false;
    selectedTransaction.value = null;
    // Query cache will be automatically invalidated
  }
}

function goBack() {
  navigateBack();
}

// Set as default account
const isSettingDefault = ref(false);
async function handleSetAsDefault() {
  if (!account.value) return;
  isSettingDefault.value = true;
  try {
    await setDefaultAccount(account.value.id);
  } finally {
    isSettingDefault.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <!-- Header -->
    <AppHeader :title="account?.name ?? 'Счёт'" show-back blur @back="goBack" />

    <!-- Content -->
    <main class="px-5 pt-8 pb-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <USpinner />
      </div>

      <!-- Not Found State -->
      <NotFoundState v-else-if="!account" message="Счёт не найден" />

      <!-- Account Details -->
      <div v-else class="space-y-6">
        <!-- Main Card -->
        <UCard class="p-5">
          <div class="flex items-start gap-4">
            <!-- Icon -->
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              :style="{ backgroundColor: `${account.color}20` }"
            >
              <UIcon
                :name="account.icon"
                size="lg"
                :style="{ color: account.color }"
              />
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p
                  class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark truncate"
                >
                  {{ account.name }}
                </p>
                <span
                  v-if="isDefaultAccount(account.id)"
                  class="shrink-0 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                >
                  По умолчанию
                </span>
              </div>
              <p
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
              >
                {{ getAccountTypeLabel(account.type) }}
              </p>
            </div>
          </div>

          <!-- Credit Card Balances -->
          <div
            v-if="
              account.type === 'credit_card' && account.credit_limit != null
            "
            class="mt-6 pt-6 border-t border-border-light dark:border-border-dark space-y-4"
          >
            <div
              v-for="balance in account.balances"
              :key="balance.currency"
              class="space-y-3"
            >
              <!-- Balance row -->
              <div class="flex justify-between items-center">
                <span
                  class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >
                  {{
                    balance.balance < 0
                      ? 'Задолженность'
                      : 'Собственные средства'
                  }}
                </span>
                <span
                  class="text-xl font-bold"
                  :class="
                    balance.balance < 0
                      ? 'text-danger'
                      : 'text-text-primary-light dark:text-text-primary-dark'
                  "
                >
                  {{ formatCurrency(balance.balance, balance.currency) }}
                </span>
              </div>

              <!-- Available -->
              <div class="flex justify-between items-center">
                <span
                  class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                  >Доступно</span
                >
                <span class="text-sm font-semibold text-success">
                  {{
                    formatCurrency(
                      account.credit_limit + balance.balance,
                      balance.currency,
                    )
                  }}
                </span>
              </div>

              <!-- Limit -->
              <div class="flex justify-between items-center">
                <span
                  class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                  >Лимит</span
                >
                <span
                  class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
                >
                  {{ formatCurrency(account.credit_limit, balance.currency) }}
                </span>
              </div>

              <!-- Progress bar -->
              <div
                v-if="balance.balance < 0 && account.credit_limit > 0"
                class="space-y-1"
              >
                <div
                  class="h-2 rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden"
                >
                  <div
                    class="h-full rounded-full transition-all duration-300"
                    :class="
                      Math.abs(balance.balance) / account.credit_limit > 0.8
                        ? 'bg-danger'
                        : 'bg-primary'
                    "
                    :style="{
                      width: `${Math.min((Math.abs(balance.balance) / account.credit_limit) * 100, 100)}%`,
                    }"
                  />
                </div>
                <p
                  class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark text-right"
                >
                  {{
                    Math.round(
                      (Math.abs(balance.balance) / account.credit_limit) * 100,
                    )
                  }}% использовано
                </p>
              </div>
            </div>
          </div>

          <!-- Regular Balances -->
          <div
            v-else
            class="mt-6 pt-6 border-t border-border-light dark:border-border-dark"
          >
            <span
              class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
            >
              Баланс
            </span>
            <div class="mt-2 space-y-2">
              <div
                v-for="balance in account.balances"
                :key="balance.currency"
                class="flex justify-between items-center"
              >
                <span
                  class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >
                  {{ balance.currency }}
                </span>
                <span
                  class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark"
                >
                  {{ formatCurrency(balance.balance, balance.currency) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div
            class="mt-6 pt-6 border-t border-border-light dark:border-border-dark space-y-3"
          >
            <!-- Set as default -->
            <UButton
              v-if="!isDefaultAccount(account.id)"
              variant="secondary"
              full-width
              :disabled="isSettingDefault"
              @click="handleSetAsDefault"
            >
              <UIcon name="star" size="sm" class="mr-2" />
              {{ isSettingDefault ? 'Сохранение...' : 'Сделать по умолчанию' }}
            </UButton>

            <!-- Edit/Delete row -->
            <div class="flex gap-3">
              <UButton
                variant="primary"
                full-width
                @click="showEditAccountModal = true"
              >
                <UIcon name="edit" size="sm" class="mr-2" />
                Редактировать
              </UButton>
              <UButton
                variant="ghost"
                class="!text-danger shrink-0"
                @click="openDeleteModal"
              >
                <UIcon name="delete" size="md" />
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Type-Specific Info -->
        <UCard
          v-if="
            account.type === 'credit_card' &&
            (account.grace_period_days != null || account.billing_day != null)
          "
          class="p-5"
        >
          <h3
            class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-3"
          >
            Параметры кредитной карты
          </h3>
          <div class="space-y-2">
            <div
              v-if="account.grace_period_days != null"
              class="flex justify-between"
            >
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >Грейс-период</span
              >
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
                >{{ account.grace_period_days }} дней</span
              >
            </div>
            <div
              v-if="account.billing_day != null"
              class="flex justify-between"
            >
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >День выписки</span
              >
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
                >{{ account.billing_day }}-е число</span
              >
            </div>
          </div>
        </UCard>

        <UCard
          v-if="
            account.type === 'loan' &&
            (account.total_amount != null || account.interest_rate != null)
          "
          class="p-5"
        >
          <h3
            class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-3"
          >
            Параметры кредита
          </h3>
          <div class="space-y-2">
            <div
              v-if="account.total_amount != null"
              class="flex justify-between"
            >
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >Сумма кредита</span
              >
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
              >
                {{
                  formatCurrency(
                    account.total_amount,
                    account.balances?.[0]?.currency ?? 'UZS',
                  )
                }}
              </span>
            </div>
            <div
              v-if="account.interest_rate != null"
              class="flex justify-between"
            >
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >Ставка</span
              >
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
                >{{ account.interest_rate }}%</span
              >
            </div>
            <div
              v-if="account.monthly_payment != null"
              class="flex justify-between"
            >
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >Ежемесячный платёж</span
              >
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
              >
                {{
                  formatCurrency(
                    account.monthly_payment,
                    account.balances?.[0]?.currency ?? 'UZS',
                  )
                }}
              </span>
            </div>
            <div v-if="account.start_date" class="flex justify-between">
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >Дата начала</span
              >
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
                >{{ account.start_date }}</span
              >
            </div>
            <div v-if="account.end_date" class="flex justify-between">
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >Дата окончания</span
              >
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
                >{{ account.end_date }}</span
              >
            </div>
          </div>
        </UCard>

        <UCard
          v-if="
            account.type === 'deposit' &&
            (account.interest_rate != null || account.maturity_date != null)
          "
          class="p-5"
        >
          <h3
            class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-3"
          >
            Параметры вклада
          </h3>
          <div class="space-y-2">
            <div
              v-if="account.interest_rate != null"
              class="flex justify-between"
            >
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >Ставка</span
              >
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
                >{{ account.interest_rate }}%</span
              >
            </div>
            <div v-if="account.maturity_date" class="flex justify-between">
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >Дата окончания</span
              >
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
                >{{ account.maturity_date }}</span
              >
            </div>
            <div
              v-if="account.is_replenishable != null"
              class="flex justify-between"
            >
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >Пополняемый</span
              >
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
                >{{ account.is_replenishable ? 'Да' : 'Нет' }}</span
              >
            </div>
            <div
              v-if="account.is_withdrawable != null"
              class="flex justify-between"
            >
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
                >С возможностью снятия</span
              >
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
                >{{ account.is_withdrawable ? 'Да' : 'Нет' }}</span
              >
            </div>
          </div>
        </UCard>

        <!-- Transactions Section -->
        <div>
          <h2
            class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4"
          >
            Транзакции
          </h2>

          <!-- Loading Transactions -->
          <div
            v-if="isLoadingTransactions && accountTransactions.length === 0"
            class="space-y-4"
          >
            <TransactionGroupSkeleton :count="3" />
            <TransactionGroupSkeleton :count="2" />
          </div>

          <!-- Empty State -->
          <EmptyState
            v-else-if="accountTransactions.length === 0"
            icon="receipt_long"
            title="Нет транзакций по этому счёту"
          />

          <!-- Virtualized Transaction Groups -->
          <VirtualGroupedTransactionList
            v-else
            :groups="groupedTransactions"
            :currency="currency"
            :has-next-page="hasNextPage"
            :is-fetching-next-page="isFetchingNextPage"
            :get-account-name="getAccountName"
            height="400px"
            @load-more="fetchNextPage"
            @transaction-click="handleTransactionClick"
          />
        </div>
      </div>
    </main>

    <!-- Edit Account Modal -->
    <EditAccountModal
      v-model="showEditAccountModal"
      :account="account"
      :is-updating="isUpdatingAccount"
      @confirm="handleUpdateAccount"
    />

    <!-- Delete Account Modal -->
    <DeleteAccountModal
      v-model="showDeleteAccountModal"
      :account="account"
      :transactions-count="accountTransactionsCount ?? 0"
      :is-loading-count="isLoadingTransactionsCount"
      :currency="currency"
      :is-deleting="isDeletingAccount"
      :error="accountError"
      @confirm="handleDeleteAccount"
    />

    <!-- Edit Transaction Modal -->
    <EditTransactionModal
      v-model="showEditTransactionModal"
      :transaction="selectedTransaction"
      :currency="currency"
      :is-updating="isUpdatingTransaction"
      :error="transactionError"
      :has-split-debts="selectedTransactionHasSplitDebts"
      @confirm="handleUpdateTransaction"
      @delete="handleDeleteTransactionClick"
    />

    <!-- Delete Transaction Modal -->
    <DeleteTransactionModal
      v-model="showDeleteTransactionModal"
      :transaction="selectedTransaction"
      :currency="currency"
      :is-deleting="isDeletingTransaction"
      @confirm="handleDeleteTransaction"
    />
  </div>
</template>
