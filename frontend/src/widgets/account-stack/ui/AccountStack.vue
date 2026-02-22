<script setup lang="ts">
import { AccountCard, type AccountWithBalances } from '@/entities/account';
import { SectionHeader, EmptyState, Skeleton } from '@/shared/ui';

defineProps<{
  accounts: AccountWithBalances[];
  loading?: boolean;
  hidden?: boolean;
}>();

defineEmits<{
  'account-click': [account: AccountWithBalances];
  'add-click': [];
  'view-all': [];
}>();
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <SectionHeader
      title="Счета"
      :count="accounts.length"
      :show-view-all="accounts.length > 0"
      @add-click="$emit('add-click')"
      @view-all="$emit('view-all')"
    />

    <!-- Loading state -->
    <div v-if="loading" class="space-y-1">
      <Skeleton v-for="i in 3" :key="i" class="h-14 rounded-xl" />
    </div>

    <!-- Account List -->
    <div
      v-else-if="accounts.length > 0"
      class="rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark overflow-hidden"
    >
      <AccountCard
        v-for="(account, index) in accounts"
        :key="account.id"
        :account="account"
        :compact="true"
        :hidden="hidden"
        :class="[
          '!rounded-none !border-0',
          index < accounts.length - 1 && 'border-b border-border-light dark:border-border-dark',
        ]"
        @click="$emit('account-click', account)"
      />
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else
      variant="inline"
      icon="account_balance_wallet"
      title="У вас пока нет счетов"
      description="Добавьте первый счёт для начала"
      :action="{ label: 'Создать счёт', onClick: () => $emit('add-click') }"
    />
  </div>
</template>
