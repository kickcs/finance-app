<script setup lang="ts">
import { computed } from 'vue';
import { TransactionItem, TransactionItemSkeleton } from '@/entities/transaction';
import type { Transaction } from '@/entities/transaction';
import { UIcon, UButton, EmptyState } from '@/shared/ui';
import { useAccounts } from '@/entities/account';

const props = defineProps<{
  transactions: Transaction[];
  userId: string;
  loading?: boolean;
  hidden?: boolean;
}>();

defineEmits<{
  'transaction-click': [transaction: Transaction];
  'view-all': [];
  'add-click': [];
}>();

const { accounts } = useAccounts(computed(() => props.userId));

function getAccountName(accountId: string): string {
  return accounts.value?.find((a) => a.id === accountId)?.name || '';
}

function getToAccountName(toAccountId: string | null): string {
  if (!toAccountId) return '';
  return accounts.value?.find((a) => a.id === toAccountId)?.name || '';
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <h2 class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
          Последние операции
        </h2>
      </div>
      <div class="flex items-center gap-1">
        <UButton
          variant="ghost"
          size="xs"
          @click="$emit('add-click')"
        >
          <UIcon name="add" size="xs" />
        </UButton>
        <UButton
          v-if="transactions.length > 0"
          variant="ghost"
          size="xs"
          @click="$emit('view-all')"
        >
          Все
          <template #icon-right>
            <UIcon name="chevron_right" size="xs" />
          </template>
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
      <TransactionItemSkeleton v-for="i in 3" :key="i" />
    </div>

    <EmptyState
      v-else-if="transactions.length === 0"
      icon="receipt_long"
      title="Нет операций"
      description="Добавьте первую транзакцию"
    >
      <UButton variant="primary" size="sm" @click="$emit('add-click')">
        Добавить
      </UButton>
    </EmptyState>

    <div
      v-else
      class="rounded-xl border border-border-light dark:border-border-dark overflow-hidden divide-y divide-border-light dark:divide-border-dark"
    >
      <TransactionItem
        v-for="tx in transactions"
        :key="tx.id"
        :transaction="tx"
        :account-name="getAccountName(tx.account_id)"
        :to-account-name="getToAccountName(tx.to_account_id)"
        @click="$emit('transaction-click', tx)"
      />
    </div>
  </div>
</template>
