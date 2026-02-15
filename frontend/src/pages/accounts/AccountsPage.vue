<script setup lang="ts">
import { computed, inject } from 'vue';
import type { Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';
import { useRouter } from 'vue-router';
import { AppHeader } from '@/widgets/header';
import { navigateBack } from '@/app/router';
import { BottomNav } from '@/widgets/bottom-nav';
import {
  AccountCard,
  useAccounts,
  type AccountWithBalances,
} from '@/entities/account';
import { UButton, UIcon, UCard } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useProfile, useExchangeRates } from '@/shared/api';

const router = useRouter();

// Get user from provide/inject
const user = inject<Ref<User | null>>('user');
const userId = computed(() => user?.value?.id ?? '');

// Get user currency from profile
const { profile } = useProfile(userId);
const currency = computed(
  () =>
    profile.value?.currency ||
    localStorage.getItem('selectedCurrency') ||
    'UZS',
);

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
          class="py-12 text-center bg-card-light dark:bg-card-dark rounded-2xl"
        >
          <div
            class="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-light dark:bg-surface-dark flex items-center justify-center"
          >
            <UIcon
              name="account_balance_wallet"
              size="lg"
              class="text-text-tertiary-light dark:text-text-tertiary-dark"
            />
          </div>
          <p
            class="text-text-secondary-light dark:text-text-secondary-dark mb-4"
          >
            У вас пока нет счетов
          </p>
          <UButton variant="primary" @click="handleAddAccount">
            <UIcon name="add" size="sm" class="mr-1" />
            Создать счёт
          </UButton>
        </div>
      </div>
    </main>

    <!-- Bottom Navigation -->
    <BottomNav @add-click="handleAddTransaction" />
  </div>
</template>
