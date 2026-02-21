<script setup lang="ts">
import { computed } from 'vue';
import {
  TransactionItem,
  TransactionItemSkeleton,
} from '@/entities/transaction';
import type { Transaction } from '@/entities/transaction';
import { EmptyState, SectionHeader } from '@/shared/ui';
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
    <SectionHeader
      title="Последние операции"
      :count="transactions.length"
      :show-view-all="transactions.length > 0"
      class="mb-3"
      @add-click="$emit('add-click')"
      @view-all="$emit('view-all')"
    />

    <div
      v-if="loading"
      class="rounded-xl border border-border-light dark:border-border-dark overflow-hidden"
    >
      <TransactionItemSkeleton v-for="i in 3" :key="i" />
    </div>

    <EmptyState
      v-else-if="transactions.length === 0"
      icon="receipt_long"
      title="Нет операций"
      description="Добавьте первую транзакцию"
      pulse-action
      :action="{ label: 'Добавить', onClick: () => $emit('add-click') }"
    />

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
