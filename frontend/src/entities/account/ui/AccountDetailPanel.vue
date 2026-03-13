<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { UButton, UIcon, UCard, UProgressBar, EmptyState, USpinner } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useAccounts, getAccountTypeLabel } from '@/entities/account';
import { DEBT_CATEGORY_IDS } from '@/entities/category';
import {
  TransactionItem,
  TransactionGroupSkeleton,
  useInfiniteAccountTransactions,
  useGroupedTransactions,
} from '@/entities/transaction';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { formatDateGroup } from '@/shared/lib/format/date';

const props = defineProps<{
  accountId: string;
  userId: string;
}>();

const emit = defineEmits<{
  edit: [];
  delete: [];
}>();

const router = useRouter();
const { currency } = useUserCurrency();

const { accounts, isLoading: isLoadingAccounts } = useAccounts(() => props.userId);

const account = computed(() => {
  return accounts.value.find((a) => a.id === props.accountId) ?? null;
});

// Account transactions with infinite scroll
const {
  transactions: accountTransactions,
  isLoading: isLoadingTransactions,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
} = useInfiniteAccountTransactions(() => props.accountId);

// Helper to get account name by id
function getAccountName(id: string | null): string {
  if (!id) return 'Счёт';
  const acc = accounts.value.find((a) => a.id === id);
  return acc?.name || 'Счёт';
}

// Group transactions by date
const groupedTransactions = useGroupedTransactions(accountTransactions, {
  sortGroups: false,
  sortTransactions: (a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  },
  computeTotal: (txs) => {
    const currentAccountId = props.accountId;
    return txs.reduce((sum, tx) => {
      if (DEBT_CATEGORY_IDS.has(tx.category_id)) return sum;
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
</script>

<template>
  <div class="py-8 space-y-6">
    <!-- Loading State -->
    <div v-if="isLoadingAccounts" class="flex items-center justify-center py-12">
      <USpinner />
    </div>

    <!-- Account not found -->
    <div
      v-else-if="!account"
      class="flex flex-col items-center justify-center py-12 text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      <UIcon name="error" size="xl" class="mb-2 opacity-40" />
      <p class="text-sm">Счёт не найден</p>
    </div>

    <!-- Account Details -->
    <template v-else>
      <!-- Main Info Card -->
      <UCard class="p-5" variant="bordered">
        <div class="flex items-start gap-4 mb-4">
          <!-- Icon -->
          <div
            class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
            :style="{ backgroundColor: `${account.color}15` }"
          >
            <UIcon :name="account.icon" size="lg" :style="{ color: account.color }" />
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0 pt-1">
            <p
              class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark truncate"
            >
              {{ account.name }}
            </p>
            <p
              class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mt-0.5"
            >
              {{ getAccountTypeLabel(account.type) }}
            </p>
          </div>
        </div>

        <!-- Credit Card Balances -->
        <div
          v-if="account.type === 'credit_card' && account.credit_limit != null"
          class="pt-4 border-t border-border-light dark:border-border-dark space-y-4"
        >
          <div v-for="balance in account.balances" :key="balance.currency" class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {{ balance.balance < 0 ? 'Задолженность' : 'Собственные средства' }}
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

            <div class="flex justify-between items-center">
              <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                Доступно
              </span>
              <span class="text-sm font-semibold text-success">
                {{ formatCurrency(account.credit_limit + balance.balance, balance.currency) }}
              </span>
            </div>

            <div class="flex justify-between items-center">
              <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                Лимит
              </span>
              <span
                class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
              >
                {{ formatCurrency(account.credit_limit, balance.currency) }}
              </span>
            </div>

            <!-- Progress bar -->
            <div v-if="balance.balance < 0 && account.credit_limit > 0">
              <UProgressBar
                :value="Math.abs(balance.balance)"
                :max="account.credit_limit"
                :color="
                  Math.abs(balance.balance) / account.credit_limit > 0.8 ? 'danger' : 'primary'
                "
                show-label
                aria-label="Использование кредитного лимита"
              >
                <template #label>
                  <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                    использовано
                  </span>
                </template>
              </UProgressBar>
            </div>
          </div>
        </div>

        <!-- Regular Balances -->
        <div v-else class="pt-4 border-t border-border-light dark:border-border-dark">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Баланс
          </span>
          <div class="mt-2 space-y-2">
            <div
              v-for="balance in account.balances"
              :key="balance.currency"
              class="flex justify-between items-center"
            >
              <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {{ balance.currency }}
              </span>
              <span class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
                {{ formatCurrency(balance.balance, balance.currency) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-2 mt-4">
          <UButton variant="secondary" class="flex-1" @click="emit('edit')">
            <UIcon name="edit" size="sm" class="mr-1.5" />
            Редактировать
          </UButton>
          <UButton
            variant="icon"
            class="!text-danger w-11 shrink-0 hover:bg-danger/10"
            aria-label="Удалить счёт"
            @click="emit('delete')"
          >
            <UIcon name="delete" size="sm" />
          </UButton>
        </div>
      </UCard>

      <!-- Recent Transactions -->
      <div>
        <h2 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
          Транзакции
        </h2>

        <!-- Loading -->
        <div v-if="isLoadingTransactions && accountTransactions.length === 0" class="space-y-4">
          <TransactionGroupSkeleton :count="3" />
          <TransactionGroupSkeleton :count="2" />
        </div>

        <!-- Empty -->
        <UCard v-else-if="accountTransactions.length === 0" variant="bordered" class="py-6">
          <EmptyState
            icon="receipt_long"
            title="Здесь пока пусто"
            description="Добавьте первую транзакцию по этому счету"
            :action="{
              label: 'Добавить',
              onClick: () => router.push({ name: ROUTE_NAMES.NEW_TRANSACTION }),
            }"
          />
        </UCard>

        <!-- Transaction Groups -->
        <div v-else class="space-y-4">
          <div v-for="group in groupedTransactions" :key="group.date">
            <!-- Group Header -->
            <div class="flex items-center justify-between mb-2">
              <span
                class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
              >
                {{ formatDateGroup(group.date) }}
              </span>
              <span
                class="text-xs font-medium"
                :class="
                  group.total >= 0
                    ? 'text-success'
                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                "
              >
                {{ group.total >= 0 ? '+' : '' }}{{ formatCurrency(group.total, currency) }}
              </span>
            </div>

            <!-- Transactions -->
            <UCard variant="bordered" class="divide-y divide-border-light dark:divide-border-dark">
              <TransactionItem
                v-for="tx in group.transactions"
                :key="tx.id"
                :transaction="tx"
                :currency="currency"
                :account-name="getAccountName(tx.account_id)"
                :to-account-name="getAccountName(tx.to_account_id)"
                :viewing-account-id="accountId"
                class="px-4 py-3"
              />
            </UCard>
          </div>

          <!-- Load more -->
          <div v-if="hasNextPage" class="flex justify-center py-2">
            <UButton
              variant="ghost"
              size="sm"
              :loading="isFetchingNextPage"
              @click="() => fetchNextPage()"
            >
              Загрузить ещё
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
