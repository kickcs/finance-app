<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { VISIBLE_ACCOUNT_TYPES } from '@/entities/account';
import type { AccountWithBalances } from '@/shared/api/database.types';
import type { ImportedTransaction } from '@/entities/imported-transaction';
import { checkBalanceAfter } from '../model/balanceCheck';

const props = defineProps<{
  accounts: AccountWithBalances[];
  hiddenAccountIds: Set<string>;
  item: ImportedTransaction;
}>();

// Нескрытые (dashboard_settings.hidden_account_ids) видимые типы счетов.
const visibleAccounts = computed(() =>
  props.accounts.filter(
    (a) =>
      !props.hiddenAccountIds.has(a.id) &&
      (VISIBLE_ACCOUNT_TYPES as readonly string[]).includes(a.type),
  ),
);

// Мемоизация балансов: счёта в валюте импорта; если её нет — первый доступный.
const displayBalances = computed(
  () =>
    new Map(
      visibleAccounts.value.map((account) => [
        account.id,
        account.balances.find((b) => b.currency === props.item.currency) ??
          account.balances[0] ??
          null,
      ]),
    ),
);

const highlightedId = computed(() => props.item.suggested_account_id);

// Сверка с банком — только для счёта, привязанного к карте, и только если у него
// есть баланс в валюте импорта.
const balanceCheck = computed(() => {
  const account = visibleAccounts.value.find((a) => a.id === highlightedId.value);
  const balance = displayBalances.value.get(account?.id ?? '');
  if (!balance) return null;
  return checkBalanceAfter(balance.balance, props.item);
});
</script>

<template>
  <section v-if="visibleAccounts.length > 0" class="space-y-1.5 animate-fadeInUp">
    <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 md:mx-0 md:px-0">
      <div
        v-for="account in visibleAccounts"
        :key="account.id"
        class="shrink-0 rounded-xl border px-3 py-1.5"
        :class="
          account.id === highlightedId
            ? 'border-primary/40 bg-primary-light'
            : 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark'
        "
      >
        <p
          class="text-[0.6875rem] text-text-tertiary-light dark:text-text-tertiary-dark truncate max-w-[8rem]"
        >
          {{ account.name }}
        </p>
        <p class="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
          {{
            displayBalances.get(account.id)
              ? formatCurrency(
                  displayBalances.get(account.id)!.balance,
                  displayBalances.get(account.id)!.currency,
                )
              : '—'
          }}
        </p>
      </div>
    </div>

    <!-- Сверка с балансом из банковского уведомления -->
    <p
      v-if="item.balance_after !== null && balanceCheck"
      class="flex items-center gap-1.5 text-xs px-0.5"
      :class="balanceCheck.matches ? 'text-success' : 'text-warning'"
    >
      <UIcon :name="balanceCheck.matches ? 'check_circle' : 'warning'" size="xs" />
      <span>
        Банк после операции: {{ formatCurrency(item.balance_after, item.currency) }}
        <template v-if="!balanceCheck.matches">
          · в приложении будет {{ formatCurrency(balanceCheck.expected, item.currency) }}
        </template>
      </span>
    </p>
  </section>
</template>
