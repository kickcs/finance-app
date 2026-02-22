<script setup lang="ts">
import { computed, ref } from 'vue';
import { UInput, UButton, UIcon } from '@/shared/ui';
import { CURRENCIES, getCurrencyByCode } from '@/entities/currency';
import type { CurrencyBalance } from '../model/useCreateAccount';

const props = defineProps<{
  balances: CurrencyBalance[];
  label?: string;
  hint?: string;
}>();

const emit = defineEmits<{
  add: [currency: string];
  remove: [index: number];
  updateBalance: [index: number, balance: number];
  updateCurrency: [index: number, currency: string];
}>();

const showCurrencyPicker = ref(false);

// Currencies not yet added
const availableCurrencies = computed(() => {
  const usedCurrencies = props.balances.map((b) => b.currency);
  return CURRENCIES.filter((c) => !usedCurrencies.includes(c.code));
});

function addCurrency(code: string) {
  emit('add', code);
  showCurrencyPicker.value = false;
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        {{ label ?? 'Валюты и балансы' }}
      </label>
      <p v-if="hint" class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5">
        {{ hint }}
      </p>
    </div>

    <!-- Balance items -->
    <div class="space-y-3">
      <div v-for="(balance, index) in balances" :key="index" class="flex items-stretch gap-2">
        <!-- Currency selector - styled to match UInput, stretches to same height -->
        <div
          class="relative shrink-0 w-24 flex items-center rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark transition-all duration-200 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-0"
        >
          <select
            :value="balance.currency"
            class="w-full h-full pl-3 pr-8 appearance-none bg-transparent text-sm font-medium text-text-primary-light dark:text-text-primary-dark focus:outline-none"
            @change="$emit('updateCurrency', index, ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="curr in CURRENCIES"
              :key="curr.code"
              :value="curr.code"
              :disabled="balances.some((b, i) => i !== index && b.currency === curr.code)"
            >
              {{ curr.flag }} {{ curr.code }}
            </option>
          </select>
          <UIcon
            name="expand_more"
            size="sm"
            class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </div>

        <!-- Balance input -->
        <div class="flex-1 min-w-0">
          <UInput
            :model-value="String(balance.balance)"
            placeholder="0"
            variant="currency"
            :suffix="getCurrencyByCode(balance.currency)?.symbol || balance.currency"
            @update:model-value="$emit('updateBalance', index, Number($event) || 0)"
          />
        </div>

        <!-- Remove button (only shown when multiple currencies) -->
        <button
          v-if="balances.length > 1"
          type="button"
          class="shrink-0 self-center p-2 rounded-lg hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
          @click="$emit('remove', index)"
        >
          <UIcon
            name="close"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </button>
      </div>
    </div>

    <!-- Add currency button -->
    <div v-if="availableCurrencies.length > 0">
      <div v-if="!showCurrencyPicker">
        <UButton type="button" variant="ghost" size="sm" @click="showCurrencyPicker = true">
          <UIcon name="add" size="sm" class="mr-1" />
          Добавить валюту
        </UButton>
      </div>

      <!-- Currency picker dropdown -->
      <div v-else class="flex flex-wrap gap-2 p-3 bg-surface-light dark:bg-surface-dark rounded-xl">
        <button
          v-for="currency in availableCurrencies"
          :key="currency.code"
          type="button"
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark hover:bg-primary/10 transition-colors text-sm"
          @click="addCurrency(currency.code)"
        >
          <span>{{ currency.flag }}</span>
          <span class="font-medium">{{ currency.code }}</span>
        </button>
        <button
          type="button"
          class="px-3 py-2 text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
          @click="showCurrencyPicker = false"
        >
          Отмена
        </button>
      </div>
    </div>
  </div>
</template>
