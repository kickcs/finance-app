<script setup lang="ts">
import { ref, computed } from 'vue';
import { CurrencyList } from '@/widgets/currency-list';
import { UButton, UIcon } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';
import {
  getCurrencyByCode,
  CURRENCIES,
  type Currency,
} from '@/entities/currency';
import { navigateBack } from '@/app/router';
import { useProfile, useAuth } from '@/shared/api';

const { user } = useAuth();
const { setCurrency: saveCurrency } = useProfile(
  computed(() => user.value?.id ?? null),
);

// Get current currency from localStorage
const currentCurrencyCode = computed(
  () => localStorage.getItem('selectedCurrency') || 'UZS',
);
const selectedCurrency = ref<Currency | null>(
  getCurrencyByCode(currentCurrencyCode.value) ?? null,
);

// Get account currencies from localStorage
const initialAccountCurrencies = JSON.parse(
  localStorage.getItem('accountCurrencies') || '[]',
) as string[];
const accountCurrencies = ref<string[]>(initialAccountCurrencies);

// Check if there are changes to save
const hasChanges = computed(() => {
  const currencyChanged =
    selectedCurrency.value?.code !== currentCurrencyCode.value;
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
        'accountCurrencies',
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
  <div
    class="min-h-screen bg-background-light dark:bg-background-dark flex flex-col pb-28"
  >
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
    <main class="flex-1 px-5 pt-8 pb-10 space-y-8">
      <!-- Main Currency Section -->
      <section>
        <p
          class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2"
        >
          Основная валюта
        </p>
        <p
          class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4"
        >
          Отображается во всём приложении, все суммы конвертируются в эту валюту
        </p>
        <CurrencyList
          :selected-code="selectedCurrency?.code"
          @select="handleSelect"
        />
      </section>

      <!-- Account Currencies Section -->
      <section>
        <p
          class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2"
        >
          Валюты для счетов
        </p>
        <p
          class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4"
        >
          Эти валюты будут предлагаться при создании нового счёта
        </p>

        <div class="space-y-2">
          <button
            v-for="curr in CURRENCIES"
            :key="curr.code"
            type="button"
            class="w-full flex items-center gap-4 p-4 rounded-2xl transition-all hover:bg-surface-light dark:hover:bg-surface-dark"
            @click="toggleAccountCurrency(curr.code)"
          >
            <span class="text-2xl">{{ curr.flag }}</span>
            <div class="flex-1 text-left">
              <p
                class="font-semibold text-text-primary-light dark:text-text-primary-dark"
              >
                {{ curr.code }}
              </p>
              <p
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
              >
                {{ curr.name }}
              </p>
            </div>
            <div
              :class="[
                'w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all',
                accountCurrencies.includes(curr.code)
                  ? 'bg-primary border-primary'
                  : 'border-gray-300 dark:border-gray-600',
              ]"
            >
              <UIcon
                v-if="accountCurrencies.includes(curr.code)"
                name="check"
                size="sm"
                class="text-white"
              />
            </div>
          </button>
        </div>
      </section>
    </main>
  </div>
</template>
