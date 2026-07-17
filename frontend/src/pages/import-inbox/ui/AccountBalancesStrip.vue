<script setup lang="ts">
import { computed } from 'vue';
import { formatCurrency } from '@/shared/lib/format/currency';
import { VISIBLE_ACCOUNT_TYPES } from '@/entities/account';
import type { AccountWithBalances } from '@/shared/api/database.types';

const props = defineProps<{
  accounts: AccountWithBalances[];
  hiddenAccountIds: Set<string>;
}>();

// Нескрытые (dashboard_settings.hidden_account_ids) видимые типы счетов.
const visibleAccounts = computed(() =>
  props.accounts.filter(
    (a) =>
      !props.hiddenAccountIds.has(a.id) &&
      (VISIBLE_ACCOUNT_TYPES as readonly string[]).includes(a.type),
  ),
);
</script>

<template>
  <section v-if="visibleAccounts.length > 0" class="animate-fadeInUp">
    <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
      <div
        v-for="account in visibleAccounts"
        :key="account.id"
        class="shrink-0 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-3 py-1.5"
      >
        <p
          class="text-[0.6875rem] text-text-tertiary-light dark:text-text-tertiary-dark truncate max-w-[8rem]"
        >
          {{ account.name }}
        </p>
        <p
          v-for="balance in account.balances"
          :key="balance.currency"
          class="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          {{ formatCurrency(balance.balance, balance.currency) }}
        </p>
        <p
          v-if="account.balances.length === 0"
          class="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          —
        </p>
      </div>
    </div>
  </section>
</template>
