<script setup lang="ts">
import { ref, computed } from 'vue';
import { CurrencyList } from '@/widgets/currency-list';
import { UButton, UIcon, UCard, SectionHeader } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';
import {
  getCurrencyByCode,
  CURRENCIES,
  DEFAULT_CURRENCY,
  type Currency,
} from '@/entities/currency';
import { navigateBack } from '@/app/router';
import { useProfile, useAuth } from '@/shared/api';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

const { user } = useAuth();
const { setCurrency: saveCurrency } = useProfile(computed(() => user.value?.id ?? null));

// Get current currency from localStorage
const currentCurrencyCode = computed(
  () => localStorage.getItem(STORAGE_KEYS.SELECTED_CURRENCY) || DEFAULT_CURRENCY,
);
const selectedCurrency = ref<Currency | null>(getCurrencyByCode(currentCurrencyCode.value) ?? null);

// Get account currencies from localStorage
const initialAccountCurrencies = JSON.parse(
  localStorage.getItem(STORAGE_KEYS.ACCOUNT_CURRENCIES) || '[]',
) as string[];
const accountCurrencies = ref<string[]>(initialAccountCurrencies);

// Check if there are changes to save
const hasChanges = computed(() => {
  const currencyChanged = selectedCurrency.value?.code !== currentCurrencyCode.value;
  const accountCurrenciesChanged =
    JSON.stringify([...accountCurrencies.value].sort()) !==
    JSON.stringify([...initialAccountCurrencies].sort());
  return currencyChanged || accountCurrenciesChanged;
});

function handleSelect(currency: Currency) {
  selectedCurrency.value = currency;
}

function toggleAccountCurrency(code: string) {
  const index = accountCurrencies.value.indexOf(code);
  if (index === -1) {
    accountCurrencies.value.push(code);
  } else {
    accountCurrencies.value.splice(index, 1);
  }
}

async function handleSave() {
  if (selectedCurrency.value) {
    try {
      // Save main currency to DB and localStorage
      await saveCurrency(selectedCurrency.value.code);
      // Save account currencies to localStorage
      localStorage.setItem(
        STORAGE_KEYS.ACCOUNT_CURRENCIES,
        JSON.stringify(accountCurrencies.value),
      );
      navigateBack();
    } catch (err) {
      console.error('Failed to save currency:', err);
    }
  }
}

function goBack() {
  navigateBack();
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark flex flex-col pb-28">
    <!-- Header -->
    <AppHeader title="Валюта" show-back blur @back="goBack">
      <template #actions>
        <UButton
          variant="ghost"
          size="sm"
          :disabled="!selectedCurrency || !hasChanges"
          @click="handleSave"
        >
          <span class="text-primary font-medium">Сохранить</span>
        </UButton>
      </template>
    </AppHeader>

    <!-- Content -->
    <main class="flex-1 px-5 pt-6 pb-10 space-y-8">
      <!-- Main Currency Section -->
      <section>
        <SectionHeader
          title="Основная валюта"
          :show-add="false"
          :show-view-all="false"
          class="mb-2"
        />
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4 pl-1">
          Отображается во всём приложении, все суммы конвертируются в эту валюту
        </p>
        <UCard variant="bordered" class="p-2">
          <CurrencyList :selected-code="selectedCurrency?.code" @select="handleSelect" />
        </UCard>
      </section>

      <!-- Account Currencies Section -->
      <section>
        <SectionHeader
          title="Валюты для счетов"
          :show-add="false"
          :show-view-all="false"
          class="mb-2"
        />
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4 pl-1">
          Эти валюты будут предлагаться при создании нового счёта
        </p>

        <UCard
          variant="bordered"
          class="overflow-hidden divide-y divide-border-light dark:divide-border-dark"
        >
          <button
            v-for="curr in CURRENCIES"
            :key="curr.code"
            type="button"
            class="w-full flex items-center gap-4 p-4 bg-surface-light dark:bg-surface-dark transition-all hover:bg-border-light dark:hover:bg-border-dark active:bg-border-light dark:active:bg-border-dark"
            @click="toggleAccountCurrency(curr.code)"
          >
            <span class="text-2xl shrink-0">{{ curr.flag }}</span>
            <div class="flex-1 text-left min-w-0">
              <p class="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                {{ curr.code }}
              </p>
              <p
                class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark truncate"
              >
                {{ curr.name }}
              </p>
            </div>
            <div
              :class="[
                'w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0',
                accountCurrencies.includes(curr.code)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent border-2 border-border-light dark:border-border-dark',
              ]"
            >
              <UIcon v-if="accountCurrencies.includes(curr.code)" name="check" size="sm" />
            </div>
          </button>
        </UCard>
      </section>
    </main>
  </div>
</template>
