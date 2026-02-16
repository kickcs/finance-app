<script setup lang="ts">
import { AccountCard, type AccountWithBalances } from '@/entities/account';
import { UIcon, UButton } from '@/shared/ui';

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
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h2
          class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          Счета
        </h2>
        <span
          v-if="accounts.length > 0"
          class="px-1.5 py-0.5 text-xs font-medium rounded-md bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark"
        >
          {{ accounts.length }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <UButton variant="ghost" size="xs" @click="$emit('add-click')">
          <UIcon name="add" size="xs" />
        </UButton>
        <UButton
          v-if="accounts.length > 0"
          variant="ghost"
          size="xs"
          @click="$emit('view-all')"
        >
          Все
          <UIcon name="chevron_right" size="xs" />
        </UButton>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="space-y-1">
      <div
        v-for="i in 3"
        :key="i"
        class="h-14 rounded-xl bg-surface-light dark:bg-surface-dark animate-shimmer"
      />
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
          'animate-fadeInUp !rounded-none !border-0',
          index < accounts.length - 1 && 'border-b border-border-light dark:border-border-dark',
        ]"
        :style="{ animationDelay: `${index * 0.03}s` }"
        @click="$emit('account-click', account)"
      />

    </div>

    <!-- Empty state -->
    <div
      v-else
      class="py-10 text-center rounded-xl border border-border-light dark:border-border-dark border-dashed"
    >
      <div
        class="w-12 h-12 mx-auto mb-3 rounded-lg bg-surface-light dark:bg-surface-dark flex items-center justify-center"
      >
        <UIcon
          name="account_balance_wallet"
          size="lg"
          class="text-text-tertiary-light dark:text-text-tertiary-dark"
        />
      </div>
      <p
        class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1"
      >
        У вас пока нет счетов
      </p>
      <p
        class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mb-4"
      >
        Добавьте первый счёт для начала
      </p>
      <UButton variant="primary" size="sm" @click="$emit('add-click')">
        <UIcon name="add" size="xs" class="mr-0.5" />
        Создать счёт
      </UButton>
    </div>
  </div>
</template>
