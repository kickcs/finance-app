<script setup lang="ts">
import { computed } from 'vue';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useRouter } from 'vue-router';
import { AppHeader } from '@/widgets/header';
import { navigateBack } from '@/app/router';
import { BottomNav } from '@/widgets/bottom-nav';
import {
  AccountCard,
  useAccounts,
  type AccountWithBalances,
} from '@/entities/account';
import { UButton, UIcon, UCard, EmptyState } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useExchangeRates } from '@/shared/api';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';

const router = useRouter();

const { userId } = useCurrentUser();

// Get user currency (profile-first, falls back to localStorage)
const { currency } = useUserCurrency();

// Exchange rates for currency conversion
const { convert } = useExchangeRates(currency);

// Use real data from API
const { accounts, totalBalancesByCurrency } = useAccounts(userId);

// Total balance converted to user's main currency
const totalBalance = computed(() => {
  const balances = totalBalancesByCurrency.value;
  let total = 0;
  for (const [curr, amount] of Object.entries(balances)) {
    total += convert(amount, curr);
  }
  return total;
});

function handleAccountClick(account: AccountWithBalances) {
  router.push(`/accounts/${account.id}`);
}

function handleAddAccount() {
  router.push('/accounts/new');
}

function handleAddTransaction() {
  router.push('/transactions/new');
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <!-- Header -->
    <AppHeader title="Счета">
      <template #left>
        <UButton variant="ghost" size="sm" @click="navigateBack">
          <UIcon name="arrow_back" size="md" />
        </UButton>
      </template>
      <template #actions>
        <UButton variant="ghost" icon-only @click="handleAddAccount">
          <UIcon name="add" size="md" />
        </UButton>
      </template>
    </AppHeader>

    <!-- Content -->
    <main class="px-5 pt-8 space-y-6">
      <!-- Total Balance Card -->
      <UCard class="p-5">
        <p
          class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1"
        >
          Общий баланс
        </p>
        <p
          class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark"
        >
          {{ formatCurrency(totalBalance, currency) }}
        </p>
      </UCard>

      <!-- Accounts List -->
      <div class="space-y-3">
        <h2
          class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark px-1"
        >
          Мои счета
        </h2>

        <div v-if="accounts.length > 0" class="space-y-2">
          <AccountCard
            v-for="account in accounts"
            :key="account.id"
            :account="account"
            @click="handleAccountClick(account)"
          />
        </div>

        <!-- Empty State -->
        <div
          v-else
          class="bg-card-light dark:bg-card-dark rounded-2xl"
        >
          <EmptyState
            icon="account_balance_wallet"
            title="У вас пока нет счетов"
            :action="{ label: 'Создать счёт', onClick: handleAddAccount }"
          />
        </div>
      </div>
    </main>

    <!-- Bottom Navigation -->
    <BottomNav @add-click="handleAddTransaction" />
  </div>
</template>
